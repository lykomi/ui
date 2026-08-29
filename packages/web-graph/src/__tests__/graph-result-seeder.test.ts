import { beforeEach, describe, expect, it } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import { _resetGraphToolBindings, registerGraphTool } from "../assistant-ui/graph-tool-registry.ts";
import { seedableGraphResults } from "../assistant-ui/graph-result-seeder.tsx";
import { coerceGraphPayload } from "../model.ts";

const graph = (ids: string[]): GraphPayload => ({
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: ids.map((id) => ({ id })),
  edges: [],
});

const part = (over: Record<string, unknown>) => ({
  type: "tool-call",
  toolName: "graph_expand_node",
  toolCallId: "call-1",
  args: {},
  ...over,
});

beforeEach(() => {
  _resetGraphToolBindings();
  registerGraphTool({
    toolName: "graph_expand_node",
    title: "Expand node",
    extract: (result) => coerceGraphPayload(result),
    autoOpenPanel: false,
  });
});

describe("seedableGraphResults", () => {
  it("finds a graph result the reader never expanded", () => {
    const found = seedableGraphResults([{ parts: [part({ result: graph(["a"]) })] }]);
    expect(found.map((r) => r.toolCallId)).toEqual(["call-1"]);
    expect(found[0].payload.nodes[0].id).toBe("a");
  });

  it("ignores a tool nobody bound a card to", () => {
    // Binding a card is what declares a tool graph-shaped. A tool without one
    // is exactly the case that shipped broken: a payload nothing reads.
    const found = seedableGraphResults([
      { parts: [part({ toolName: "graph_write_cypher", result: graph(["a"]) })] },
    ]);
    expect(found).toEqual([]);
  });

  it("waits for a call that is still streaming", () => {
    // `undefined` is not a failure, it is not ready — and parsing it as one
    // would seed an empty graph over a good one.
    expect(seedableGraphResults([{ parts: [part({ result: undefined })] }])).toEqual([]);
    expect(seedableGraphResults([{ parts: [part({ result: null })] }])).toEqual([]);
  });

  it("skips a result that is not graph-shaped", () => {
    expect(seedableGraphResults([{ parts: [part({ result: { rows: 3 } })] }])).toEqual([]);
  });

  it("reports each call once, keyed by call id rather than position", () => {
    const found = seedableGraphResults([
      { parts: [part({ result: graph(["a"]) }), part({ result: graph(["a"]) })] },
      { parts: [part({ toolCallId: "call-2", result: graph(["b"]) })] },
    ]);
    expect(found.map((r) => r.toolCallId)).toEqual(["call-1", "call-2"]);
  });

  it("carries the panel title the binding would have used", () => {
    registerGraphTool({
      toolName: "graph_read_cypher",
      title: "Graph query",
      extract: (result) => coerceGraphPayload(result),
      panelTitle: (payload) => `Cypher — ${payload.nodes.length} nodes`,
      autoOpenPanel: true,
    });
    const found = seedableGraphResults([
      { parts: [part({ toolName: "graph_read_cypher", result: graph(["a", "b"]) })] },
    ]);
    expect(found[0].title).toBe("Cypher — 2 nodes");
    expect(found[0].autoOpenPanel).toBe(true);
  });

  it("survives a thread with no messages at all", () => {
    expect(seedableGraphResults(undefined)).toEqual([]);
    expect(seedableGraphResults([])).toEqual([]);
  });
});
