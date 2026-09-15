import { createStore } from "zustand/vanilla";

/** Citation result shape — matches the search result format. */
export interface CitationResult {
  chunk_id: string;
  entity_id: string;
  entity_name: string;
  content: string;
  page_number: number;
  bounding_regions: string;
  /** Semantic reranker score (0-4) or RRF score (~0.03) */
  score: number;
}

/** Handler for citation clicks — registered by feature modules (e.g., SPACES). */
export interface CitationHandler {
  openCitation: (result: CitationResult) => void;
}

interface CitationState {
  /** Current search results (from the most recent search tool call) */
  results: CitationResult[];
  threadId: string | null;
  byThread: Record<string, CitationResult[]>;
  selectThread: (threadId: string) => void;
  /** Optional handler for opening citations (registered by feature modules) */
  handler: CitationHandler | null;
  /** Store search results for citation resolution */
  setResults: (results: CitationResult[], threadId: string) => void;
  /** Register a handler for citation click actions */
  setHandler: (handler: CitationHandler) => void;
  /**
   * Reset per-conversation state. Clears ``results`` only — the handler
   * is module-level state registered once at app boot by feature modules
   * (e.g. ``registerSpacesCitationHandler``) and must persist across
   * conversations. Wiping it on "New Thread" produced inert ``[n]``
   * markers for the rest of the session, since the registration guard
   * (``registerOnce`` in spaces ``use-spaces-init``) suppresses re-binding.
   */
  clear: (threadId: string) => void;
}

/**
 * Vanilla store for the citation cache so `[n]` markers in chat messages
 * resolve to clickable deep links. Search tool calls populate results; the
 * markdown renderer looks them up by index. A `CitationHandler` (registered
 * by feature modules) handles the click action.
 */
export const citationStore = createStore<CitationState>((set, get) => ({
  results: [],
  threadId: null,
  byThread: {},
  selectThread: (threadId) => set({ threadId, results: get().byThread[threadId] ?? [] }),
  handler: null,
  setResults: (results, threadId) =>
    set((s) => ({
      ...(threadId ? { byThread: { ...s.byThread, [threadId]: results } } : {}),
      ...(!threadId || s.threadId === threadId ? { results } : {}),
    })),
  setHandler: (handler) => set({ handler }),
  clear: (threadId) => get().setResults([], threadId),
}));
