/**
 * App Store — unified shared state for the AG-UI multi-page application.
 *
 * - Navigation context (synced from nav store via app-layout)
 * - Persistent vs ephemeral context lifecycle
 * - Shared UI state (selectedItemId, content, highlights)
 * - Strict AG-UI state projection sent to the agent on every request
 */

import { create } from "zustand";

export type ContextPersistence = "persistent" | "ephemeral";

// --- Domain-agnostic context payloads ---

export interface TextPayload {
  kind: "text";
  text: string;
}

export interface PagePayload {
  kind: "page";
  path: string;
  label: string;
  meta?: Record<string, unknown>;
}

export interface ReferencePayload {
  kind: "ref";
  /** Domain decides: "block", "entity", "row", "cell", etc. */
  refType: string;
  /** Domain-specific ID: "entityId:blockId", "table:row", etc. */
  refId: string;
  /** Optional display text (~100 chars) */
  preview?: string;
  /** Domain-specific data the agent can use */
  meta?: Record<string, unknown>;
}

export type ContextPayload = TextPayload | PagePayload | ReferencePayload;

export type ContextItemType = "selection" | "page" | "ref" | "note";

export interface ContextItem {
  id: string;
  type: ContextItemType;
  label: string;
  payload: ContextPayload;
  sourcePage: string;
  persistence: ContextPersistence;
  createdAt: number;
}

export interface NavContext {
  group: string | null;
  groupDescription: string | null;
  groupMeta: Record<string, unknown>;
  label: string;
  description: string | null;
  meta: Record<string, unknown>;
  /** Merged instructions from group + page (assembled by app-layout from hierarchy) */
  contextInstructions: string | null;
}

export interface AgentStateProjection {
  navigation: {
    group: string | null;
    groupDescription: string | null;
    groupMeta: Record<string, unknown>;
    page: string;
    label: string;
    description: string | null;
    meta: Record<string, unknown>;
    contextInstructions: string | null;
  };
  selectedItemId: string | null;
  content: Record<string, unknown>;
  highlights: string[];
  /** Compact context items — text truncated, pages as paths, refs as IDs */
  contextItems: Array<Record<string, unknown>>;
}

const MAX_ITEMS = 10;
const MAX_LABEL_LENGTH = 500;

const DEFAULT_NAV_CONTEXT: NavContext = {
  group: null,
  groupDescription: null,
  groupMeta: {},
  label: "Chat",
  description: null,
  meta: {},
  contextInstructions: null,
};

interface AppState {
  // Thread state
  threadActive: boolean;
  markThreadActive: () => void;

  // Current page (set by router, used for ephemeral context clearing)
  currentPage: string;
  setCurrentPage: (page: string) => void;

  // Navigation context (synced from nav store by app-layout)
  navContext: NavContext;
  setNavContext: (ctx: NavContext) => void;

  // Shared UI state
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  content: Record<string, unknown>;
  updateContentField: (key: string, value: unknown) => void;
  clearContent: () => void;
  highlights: string[];
  addHighlight: (id: string) => void;
  removeHighlight: (id: string) => void;
  clearHighlights: () => void;

  // Context items
  contextItems: ContextItem[];
  sentContext: Record<string, ContextItem[]>;
  addContextItem: (item: Omit<ContextItem, "id" | "createdAt">) => void;
  removeContextItem: (id: string) => void;
  promoteContextItem: (id: string) => void;
  clearAllContext: () => void;
  consumeContextForMessage: (messageId: string) => ContextItem[];

  // AG-UI state projection
  getAgentState: () => AgentStateProjection;

  // Full reset (new conversation)
  resetAll: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Thread state
  threadActive: false,
  markThreadActive: () => set({ threadActive: true }),

  // Current page
  currentPage: "/chat",
  setCurrentPage: (page) => {
    const prev = get().currentPage;
    if (prev === page) return;

    // Clear ephemeral context on navigation
    set({
      currentPage: page,
      contextItems: get().contextItems.filter((i) => i.persistence !== "ephemeral"),
    });
  },

  // Navigation context
  navContext: DEFAULT_NAV_CONTEXT,
  setNavContext: (ctx) => set({ navContext: ctx }),

  // Shared UI state
  selectedItemId: null,
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  content: {},
  updateContentField: (key, value) => set({ content: { ...get().content, [key]: value } }),
  clearContent: () => set({ content: {} }),
  highlights: [],
  addHighlight: (id) => {
    const { highlights } = get();
    if (!highlights.includes(id)) {
      set({ highlights: [...highlights, id] });
    }
  },
  removeHighlight: (id) => set({ highlights: get().highlights.filter((h) => h !== id) }),
  clearHighlights: () => set({ highlights: [] }),

  // Context items
  contextItems: [],
  sentContext: {},

  addContextItem: (item) => {
    const { contextItems } = get();

    // Deduplicate by type-specific key
    const isDuplicate = contextItems.some((existing) => {
      if (item.type === "page" && existing.type === "page") {
        const a = item.payload as PagePayload;
        const b = existing.payload as PagePayload;
        return a.path === b.path;
      }
      if (item.type === "ref" && existing.type === "ref") {
        const a = item.payload as ReferencePayload;
        const b = existing.payload as ReferencePayload;
        return a.refId === b.refId;
      }
      // selection / note: dedup by label + sourcePage
      return existing.label === item.label && existing.sourcePage === item.sourcePage;
    });
    if (isDuplicate) return;

    if (contextItems.length >= MAX_ITEMS) return;

    const label =
      item.label.length > MAX_LABEL_LENGTH
        ? item.label.slice(0, MAX_LABEL_LENGTH) + "..."
        : item.label;

    set({
      contextItems: [
        ...contextItems,
        { ...item, label, id: crypto.randomUUID(), createdAt: Date.now() },
      ],
    });
  },

  removeContextItem: (id) => set({ contextItems: get().contextItems.filter((i) => i.id !== id) }),

  promoteContextItem: (id) =>
    set({
      contextItems: get().contextItems.map((i) =>
        i.id === id ? { ...i, persistence: "persistent" as const } : i,
      ),
    }),

  clearAllContext: () => set({ contextItems: [], sentContext: {} }),

  consumeContextForMessage: (messageId) => {
    const { contextItems, sentContext } = get();
    if (contextItems.length === 0) return [];

    const snapshot = [...contextItems];

    // Keep persistent, remove ephemeral
    set({
      contextItems: contextItems.filter((i) => i.persistence === "persistent"),
      sentContext: { ...sentContext, [messageId]: snapshot },
    });

    return snapshot;
  },

  // AG-UI state projection
  getAgentState: () => {
    const s = get();
    return {
      navigation: {
        group: s.navContext.group,
        groupDescription: s.navContext.groupDescription,
        groupMeta: s.navContext.groupMeta,
        page: s.currentPage,
        label: s.navContext.label,
        description: s.navContext.description,
        meta: s.navContext.meta,
        contextInstructions: s.navContext.contextInstructions,
      },
      selectedItemId: s.selectedItemId,
      content: s.content,
      highlights: s.highlights,
      contextItems: s.contextItems.map(({ type, label, payload, sourcePage }) => {
        switch (payload.kind) {
          case "text":
            return {
              type,
              label: label.slice(0, 200),
              text: payload.text.slice(0, 500),
              sourcePage,
            };
          case "page":
            return { type, label, path: payload.path, sourcePage };
          case "ref":
            return {
              type,
              refType: payload.refType,
              refId: payload.refId,
              preview: payload.preview?.slice(0, 100),
              sourcePage,
            };
          default:
            return { type, label, sourcePage };
        }
      }),
    };
  },

  // Full reset
  resetAll: () =>
    set({
      threadActive: false,
      currentPage: "/chat",
      navContext: DEFAULT_NAV_CONTEXT,
      selectedItemId: null,
      content: {},
      highlights: [],
      contextItems: [],
      sentContext: {},
    }),
}));
