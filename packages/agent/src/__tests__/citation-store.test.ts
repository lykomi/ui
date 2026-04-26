import { describe, it, expect, beforeEach } from "vitest";
import { citationStore } from "../store/citation-store.ts";
import type { CitationResult, CitationHandler } from "../store/citation-store.ts";

const mockResult: CitationResult = {
  chunk_id: "chunk-1",
  entity_id: "e-1",
  entity_name: "Test Doc",
  content: "Some content",
  page_number: 1,
  bounding_regions: "0,0,100,100",
  score: 0.95,
};

describe("citationStore", () => {
  beforeEach(() => {
    citationStore.setState({ results: [], handler: null });
  });

  describe("setResults", () => {
    it("stores citation results", () => {
      citationStore.getState().setResults([mockResult]);
      expect(citationStore.getState().results).toEqual([mockResult]);
    });
  });

  describe("setHandler", () => {
    it("registers a citation handler", () => {
      const handler: CitationHandler = { openCitation: () => {} };
      citationStore.getState().setHandler(handler);
      expect(citationStore.getState().handler).toBe(handler);
    });
  });

  describe("clear", () => {
    it("resets results and handler", () => {
      citationStore.getState().setResults([mockResult]);
      citationStore.getState().setHandler({ openCitation: () => {} });

      citationStore.getState().clear();

      expect(citationStore.getState().results).toEqual([]);
      expect(citationStore.getState().handler).toBeNull();
    });
  });
});
