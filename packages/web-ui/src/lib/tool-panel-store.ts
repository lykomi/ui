/**
 * Tool Panel State Management
 *
 * Zustand store for managing the tool panel (flyout side panel).
 * Allows both UI components and agent tools to control the panel.
 */

import { create } from "zustand";
import type { LazyExoticComponent, ComponentType } from "react";

export interface PdfHighlightRef {
  pageNumber: number;
  polygon: number[];
}

export interface ToolPanelContent {
  /** Stable result identity, preserved across updates and retained-window restoration. */
  sourceId?: string;
  /** Explicit retention preference when a window host opens this source. */
  keepOpen?: boolean;
  title: string;
  content: string;
  type: "markdown" | "text" | "page" | "pdf" | "graph";
  /** PDF highlights for citation overlays (only when type === "pdf") */
  pdfHighlights?: PdfHighlightRef[];
  /** Initial page to scroll to (only when type === "pdf") */
  initialPage?: number;
  /** SPACES entity ID — enables pin and navigate actions in panel header */
  entityId?: string;
  /**
   * Structured payload for renderers that need more than a string — a graph,
   * a chart, a table. `content` is still expected to carry a serialization, so
   * the header's Copy action and the built-in text fallback keep working when
   * no renderer matches.
   */
  data?: unknown;
}

/** Pluggable content renderer for the tool panel — registered by feature modules. */
export interface PanelRendererEntry {
  /**
   * Stable identity. When present, re-registering replaces the previous entry
   * with the same id instead of appending a second copy.
   *
   * Registration usually happens in a module's `useInit`, which runs again on
   * every remount — a StrictMode double-render, a route change, a hot reload.
   * Without an id those calls stack up, `renderers` grows without bound, and
   * `find()` keeps matching the oldest (now stale) closure. Entries without an
   * id keep the original append behaviour.
   */
  id?: string;
  /** Check if this renderer handles the given content */
  match: (content: ToolPanelContent) => boolean;
  /** Lazy component to render. Receives content as prop. */
  component: LazyExoticComponent<ComponentType<{ content: ToolPanelContent }>>;
}

const SIDE_BY_SIDE_BREAKPOINT = 1280;
/** Smallest useful panel, and the space the chat/content beside it must keep. */
export const MIN_PANEL_WIDTH = 360;
const MIN_SIBLING_WIDTH = 420;
const PANEL_WIDTH_STORAGE_KEY = "foundry.toolPanel.width";

/** Clamp a desired width so neither side can be squeezed out of usefulness. */
export const clampPanelWidth = (desired: number, viewport: number): number => {
  if (viewport < SIDE_BY_SIDE_BREAKPOINT) return viewport;
  const max = Math.max(MIN_PANEL_WIDTH, viewport - MIN_SIBLING_WIDTH);
  return Math.round(Math.min(max, Math.max(MIN_PANEL_WIDTH, desired)));
};

const readStoredPanelWidth = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null; // private mode / storage disabled — fall back to the default
  }
};

const getPanelWidth = (): number => {
  if (typeof window === "undefined") return 800;
  const screenWidth = window.innerWidth;
  if (screenWidth < SIDE_BY_SIDE_BREAKPOINT) return screenWidth;
  // A width the user dragged to wins over the computed default, re-clamped
  // to the current viewport so a narrow window can't strand the content.
  const stored = readStoredPanelWidth();
  if (stored !== null) return clampPanelWidth(stored, screenWidth);
  return Math.min(1000, Math.max(600, screenWidth * 0.5));
};

const shouldUseOverlay = (): boolean => {
  if (typeof window === "undefined") return true;
  return window.innerWidth < SIDE_BY_SIDE_BREAKPOINT;
};

interface ToolPanelState {
  isOpen: boolean;
  isWindowHosted: boolean;
  /** Keep the renderer that owns a focused host mounted while it displays another result. */
  hostedOwnerContent: ToolPanelContent | null;
  content: ToolPanelContent | null;

  // Layout state
  panelWidth: number;
  useOverlay: boolean;
  isFullscreen: boolean;

  // Pluggable content renderers (registered by feature modules)
  renderers: PanelRendererEntry[];

  // Actions
  openPanel: (content: ToolPanelContent) => void;
  closePanel: () => void;
  setContent: (content: ToolPanelContent) => void;
  updateLayout: () => void;
  toggleFullscreen: () => void;
  /** Drag-to-resize the split; clamped and persisted per user. */
  setPanelWidth: (width: number) => void;
  /** Register a custom content renderer (e.g., PDF viewer, entity pages). */
  registerRenderer: (entry: PanelRendererEntry) => void;
}

export const useToolPanelStore = create<ToolPanelState>((set, get) => ({
  isOpen: false,
  isWindowHosted: false,
  hostedOwnerContent: null,
  content: null,
  panelWidth: getPanelWidth(),
  useOverlay: shouldUseOverlay(),
  isFullscreen: false,
  renderers: [],

  openPanel: (content) => {
    content = { ...content, sourceId: content.sourceId ?? `tool:${crypto.randomUUID()}` };
    const request =
      typeof window === "undefined"
        ? null
        : new CustomEvent("preview:open-source", { detail: content, cancelable: true });
    if (request) window.dispatchEvent(request);
    const hosted = request?.defaultPrevented ?? false;
    set({
      isOpen: true,
      content,
      isWindowHosted: hosted,
      hostedOwnerContent: hosted
        ? get().isWindowHosted
          ? get().hostedOwnerContent
          : get().content
        : null,
    });
  },
  registerRenderer: (entry) =>
    set((state) => {
      if (entry.id === undefined) return { renderers: [...state.renderers, entry] };
      const index = state.renderers.findIndex((existing) => existing.id === entry.id);
      if (index === -1) return { renderers: [...state.renderers, entry] };
      // Replace in place: registration order decides which renderer wins a
      // match, so re-registering must not silently reprioritise it.
      const renderers = [...state.renderers];
      renderers[index] = entry;
      return { renderers };
    }),
  closePanel: () => set({ isOpen: false, isFullscreen: false }),
  setContent: (content) => {
    content = { ...content, sourceId: content.sourceId ?? get().content?.sourceId };
    set({ content });
    if (get().isWindowHosted && typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("preview:update-source", { detail: content }));
  },
  setPanelWidth: (width) => {
    if (typeof window === "undefined") return;
    if (get().isFullscreen) return;
    const next = clampPanelWidth(width, window.innerWidth);
    try {
      window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Persisting is best-effort; the drag still applies for this session.
    }
    set({ panelWidth: next });
  },
  updateLayout: () => {
    const { isFullscreen } = get();
    if (!isFullscreen) {
      set({
        panelWidth: getPanelWidth(),
        useOverlay: shouldUseOverlay(),
      });
    }
  },
  toggleFullscreen: () => {
    const { isFullscreen } = get();
    if (isFullscreen) {
      set({
        isFullscreen: false,
        panelWidth: getPanelWidth(),
        useOverlay: shouldUseOverlay(),
      });
    } else {
      set({
        isFullscreen: true,
        panelWidth: typeof window !== "undefined" ? window.innerWidth : 1200,
        useOverlay: true,
      });
    }
  },
}));

// Debounced resize listener
if (typeof window !== "undefined") {
  let timeout: ReturnType<typeof setTimeout>;
  window.addEventListener("resize", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      useToolPanelStore.getState().updateLayout();
    }, 100);
  });
}
