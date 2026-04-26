import { describe, it, expect, beforeEach } from "vitest";
import { useCitationStore } from "../citation-store.ts";
import type { CitationResult, CitationHandler } from "../citation-store.ts";

const mockResult: CitationResult = {
  chunk_id: "chunk-1",
  entity_id: "e-1",
  entity_name: "Test Doc",
  content: "Some content",
  page_number: 1,
  bounding_regions: "0,0,100,100",
  score: 0.95,
};

describe("useCitationStore", () => {
  beforeEach(() => {
    useCitationStore.setState({ results: [], handler: null });
  });

  describe("setResults", () => {
    it("stores citation results", () => {
      useCitationStore.getState().setResults([mockResult]);
      expect(useCitationStore.getState().results).toEqual([mockResult]);
    });
  });

  describe("setHandler", () => {
    it("registers a citation handler", () => {
      const handler: CitationHandler = { openCitation: () => {} };
      useCitationStore.getState().setHandler(handler);
      expect(useCitationStore.getState().handler).toBe(handler);
    });
  });

  describe("clear", () => {
    it("resets results and handler", () => {
      useCitationStore.getState().setResults([mockResult]);
      useCitationStore.getState().setHandler({ openCitation: () => {} });

      useCitationStore.getState().clear();

      expect(useCitationStore.getState().results).toEqual([]);
      expect(useCitationStore.getState().handler).toBeNull();
    });
  });
});
