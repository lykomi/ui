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
  /**
   * Optional exact JSON target inside the referenced domain object.
   *
   * This keeps the existing refType/refId contract stable for deep links
   * while allowing feature modules to target one schema-declared field,
   * table cell, JSON atom, or app-defined custom value precisely.
   */
  target?: {
    kind?: string;
    path?: string;
    label?: string;
    scope?: string;
    containerId?: string;
    containerLabel?: string;
    currentValue?: unknown;
    proposedValue?: unknown;
    changeIds?: string[];
    meta?: Record<string, unknown>;
  };
  /** Domain-specific data the agent can use */
  meta?: Record<string, unknown>;
}

export type ContextPayload = TextPayload | PagePayload | ReferencePayload;

export type ContextItemType = "selection" | "page" | "ref" | "note";

export interface ContextItem {
  id: string;
  /** Set for context that tracks the UI (a list's selection): one item per key. */
  key?: string;
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
const MAX_CONTEXT_VALUE_LENGTH = 2_000;
const TRUNCATION_SUFFIX = "...";

const DEFAULT_NAV_CONTEXT: NavContext = {
  group: null,
  groupDescription: null,
  groupMeta: {},
  label: "Chat",
  description: null,
  meta: {},
  contextInstructions: null,
};

function refDedupKey(payload: ReferencePayload): string {
  const selectionScope =
    typeof payload.meta?.selectionScope === "string" ? payload.meta.selectionScope : "block";
  const targetPath =
    typeof payload.target?.path === "string"
      ? payload.target.path
      : typeof payload.meta?.targetPath === "string"
        ? payload.meta.targetPath
        : undefined;

  if (selectionScope === "atom" && targetPath) {
    return `${payload.refType}:${payload.refId}:atom:${targetPath}`;
  }
  if (selectionScope === "text") {
    return `${payload.refType}:${payload.refId}:text:${payload.preview ?? ""}`;
  }
  return `${payload.refType}:${payload.refId}:block`;
}

function compactContextValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > MAX_CONTEXT_VALUE_LENGTH) {
    return `${value.slice(0, MAX_CONTEXT_VALUE_LENGTH - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
  }
  return value;
}

function compactReferenceTarget(target: ReferencePayload["target"]): ReferencePayload["target"] {
  if (!target) return undefined;
  return {
    ...target,
    currentValue: compactContextValue(target.currentValue),
    proposedValue: compactContextValue(target.proposedValue),
  };
}

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
  /** Context the user pinned. Keyed (UI-tracked) items go through
   *  `setContextItem`, which is the only thing that replaces by key. */
  addContextItem: (item: Omit<ContextItem, "id" | "createdAt" | "key">) => void;
  /**
   * Context that tracks a piece of UI rather than a user's pin — the rows
   * selected in a list, say. One item per `key`: setting replaces, `null`
   * clears. Without this, a chip that changes with the UI would pile up.
   */
  setContextItem: (key: string, item: Omit<ContextItem, "id" | "createdAt"> | null) => void;
  removeContextItem: (id: string) => void;
  promoteContextItem: (id: string) => void;
  clearAllContext: () => void;
  consumeContextForMessage: (messageId: string) => ContextItem[];

  // AG-UI state projection
  getAgentState: () => AgentStateProjection;

  // Full reset (new conversation)
  resetAll: () => void;
}

/**
 * Structural comparison that survives what a `payload` actually carries.
 *
 * `JSON.stringify` throws on a `bigint`, and a bigint is not exotic here: a
 * payload is often a database row, and the Neo4j driver returns them natively.
 * Falling back to "not equal" on the throw looks safe and is not — the guard
 * below would then treat every identical value as new, mint a fresh id and
 * array on every call, and re-open the update loop it exists to close, for
 * precisely the graphs most likely to hit it.
 */
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "bigint") return item.toString();
    if (typeof item === "object" && item !== null) {
      if (seen.has(item)) return "[circular]";
      seen.add(item);
    }
    return item;
  });
}

/**
 * Do two keyed context items carry the same value?
 *
 * Compares everything the consumer sees, ignoring the identity fields the
 * store owns (`id`, `createdAt`). `payload` is arbitrary — a selected row, a
 * graph node and its properties — so it is compared structurally.
 */
function sameContextValue(
  current: ContextItem,
  next: Omit<ContextItem, "id" | "createdAt">,
): boolean {
  const { id: _id, createdAt: _createdAt, ...rest } = current;
  return stableStringify(rest) === stableStringify(next);
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

    // Clear ephemeral context on navigation — and every KEYED item, whatever
    // its persistence: those track a piece of UI, and that UI is gone. A pin
    // the user made survives, because promoting an item drops its key.
    set({
      currentPage: page,
      contextItems: get().contextItems.filter(
        // `key === undefined`, not falsy: "" is a key someone chose, and a
        // keyed item tracks UI that this navigation just unmounted.
        (i) => i.persistence !== "ephemeral" && i.key === undefined,
      ),
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
        return refDedupKey(a) === refDedupKey(b);
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

  setContextItem: (key, item) => {
    const withoutKey = get().contextItems.filter((existing) => existing.key !== key);
    if (!item) {
      if (withoutKey.length !== get().contextItems.length) set({ contextItems: withoutKey });
      return;
    }
    if (withoutKey.length >= MAX_ITEMS) return;
    const label =
      item.label.length > MAX_LABEL_LENGTH
        ? `${item.label.slice(0, MAX_LABEL_LENGTH)}...`
        : item.label;
    // Setting the same value twice is not a change. Without this the method
    // mints a fresh `id` and a fresh array every call, so a UI that mirrors a
    // selection into context — re-asserting the same item as it re-renders —
    // churns the store, re-renders every subscriber, and can drive itself
    // into an update loop. The null branch above already declines to write
    // when nothing changes; this is the same rule for the write path.
    const current = get().contextItems.find((existing) => existing.key === key);
    const next = { ...item, key, label };
    if (current && sameContextValue(current, next)) return;
    set({
      contextItems: [...withoutKey, { ...next, id: crypto.randomUUID(), createdAt: Date.now() }],
    });
  },

  removeContextItem: (id) => set({ contextItems: get().contextItems.filter((i) => i.id !== id) }),

  promoteContextItem: (id) =>
    set({
      contextItems: get().contextItems.map((i) => {
        if (i.id !== id) return i;
        // Pinning takes the item away from the UI that was tracking it: the
        // key goes, so the next selection change replaces nothing and the
        // pin the user made survives.
        const { key: _tracked, ...rest } = i;
        return { ...rest, persistence: "persistent" as const };
      }),
    }),

  clearAllContext: () => set({ contextItems: [], sentContext: {} }),

  consumeContextForMessage: (messageId) => {
    const { contextItems, sentContext } = get();
    if (contextItems.length === 0) return [];

    const snapshot = [...contextItems];

    // Keep persistent, remove ephemeral — except context that TRACKS the UI
    // (a keyed item, e.g. a live list selection). Those rows are still
    // ticked after the message goes; dropping the chip would take them out
    // of every later message while the user can still see them selected.
    // Their owner clears them (`setContextItem(key, null)`), and navigation
    // still does.
    set({
      contextItems: contextItems.filter(
        (i) => i.persistence === "persistent" || i.key !== undefined,
      ),
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
              label: label.slice(0, 200),
              refType: payload.refType,
              refId: payload.refId,
              preview: payload.preview?.slice(0, 100),
              target: compactReferenceTarget(payload.target),
              meta: payload.meta,
              targetPath:
                typeof payload.target?.path === "string"
                  ? payload.target.path
                  : typeof payload.meta?.targetPath === "string"
                    ? payload.meta.targetPath
                    : undefined,
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
