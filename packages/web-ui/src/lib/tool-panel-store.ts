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
  title: string;
  content: string;
  type: "markdown" | "text" | "page" | "pdf";
  /** PDF highlights for citation overlays (only when type === "pdf") */
  pdfHighlights?: PdfHighlightRef[];
  /** Initial page to scroll to (only when type === "pdf") */
  initialPage?: number;
  /** SPACES entity ID — enables pin and navigate actions in panel header */
  entityId?: string;
}

/** Pluggable content renderer for the tool panel — registered by feature modules. */
export interface PanelRendererEntry {
  /** Check if this renderer handles the given content */
  match: (content: ToolPanelContent) => boolean;
  /** Lazy component to render. Receives content as prop. */
  component: LazyExoticComponent<ComponentType<{ content: ToolPanelContent }>>;
}

const SIDE_BY_SIDE_BREAKPOINT = 1280;

const getPanelWidth = (): number => {
  if (typeof window === "undefined") return 800;
  const screenWidth = window.innerWidth;
  if (screenWidth < SIDE_BY_SIDE_BREAKPOINT) return screenWidth;
  return Math.min(1000, Math.max(600, screenWidth * 0.5));
};

const shouldUseOverlay = (): boolean => {
  if (typeof window === "undefined") return true;
  return window.innerWidth < SIDE_BY_SIDE_BREAKPOINT;
};

interface ToolPanelState {
  isOpen: boolean;
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
  /** Register a custom content renderer (e.g., PDF viewer, entity pages). */
  registerRenderer: (entry: PanelRendererEntry) => void;
}

export const useToolPanelStore = create<ToolPanelState>((set, get) => ({
  isOpen: false,
  content: null,
  panelWidth: getPanelWidth(),
  useOverlay: shouldUseOverlay(),
  isFullscreen: false,
  renderers: [],

  openPanel: (content) => set({ isOpen: true, content }),
  registerRenderer: (entry) =>
    set((state) => ({ renderers: [...state.renderers, entry] })),
  closePanel: () => set({ isOpen: false, isFullscreen: false }),
  setContent: (content) => set({ content }),
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
