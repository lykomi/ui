import { afterEach, expect, it } from "vitest";
import { citationStore, type CitationResult } from "../store/citation-store.ts";

const result = (id: string): CitationResult => ({
  chunk_id: id,
  entity_id: id,
  entity_name: id,
  content: id,
  page_number: 1,
  bounding_regions: "",
  score: 1,
});
afterEach(() => citationStore.setState({ results: [], byThread: {}, threadId: null }));
it("keeps background search results out of foreground citation links", () => {
  citationStore.getState().selectThread("a");
  citationStore.getState().setResults([result("source-a")], "a");
  citationStore.getState().setResults([result("source-b")], "b");
  expect(citationStore.getState().results[0]?.entity_id).toBe("source-a");
  citationStore.getState().selectThread("b");
  expect(citationStore.getState().results[0]?.entity_id).toBe("source-b");
  citationStore.getState().clear("b");
  citationStore.getState().selectThread("a");
  expect(citationStore.getState().results[0]?.entity_id).toBe("source-a");
});
