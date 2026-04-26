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
  /** Optional handler for opening citations (registered by feature modules) */
  handler: CitationHandler | null;
  /** Store search results for citation resolution */
  setResults: (results: CitationResult[]) => void;
  /** Register a handler for citation click actions */
  setHandler: (handler: CitationHandler) => void;
  /** Clear all citations (e.g. on new conversation) */
  clear: () => void;
}

/**
 * Vanilla store for the citation cache so `[n]` markers in chat messages
 * resolve to clickable deep links. Search tool calls populate results; the
 * markdown renderer looks them up by index. A `CitationHandler` (registered
 * by feature modules) handles the click action.
 */
export const citationStore = createStore<CitationState>((set) => ({
  results: [],
  handler: null,
  setResults: (results) => set({ results }),
  setHandler: (handler) => set({ handler }),
  clear: () => set({ results: [], handler: null }),
}));
