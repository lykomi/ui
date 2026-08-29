import { describe, expect, it } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import {
  reconcileGraphModel,
  selectConnectedCore,
  type EngineNode,
  type GraphModel,
  type GraphModelLimits,
} from "../use-graph-model.ts";

/**
 * Stand-in for the hook's ref: `reconcileGraphModel` is pure and hands back the
 * next cache, so a render loop is just calling it again with what it returned.
 * That is why the reconciliation lives outside the hook — the behaviour that
 * matters here is about successive calls, not about React.
 */
function renderLoop(limits?: GraphModelLimits) {
  let cache = new Map<string, EngineNode>();
  return (payload: GraphPayload): GraphModel => {
    const result = reconcileGraphModel(payload, cache, limits);
    cache = result.cache;
    return result.model;
  };
}

const build = (nodeCount: number, edges: [number, number][] = []): GraphPayload => ({
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}`, labels: ["N"] })),
  edges: edges.map(([a, b], i) => ({ id: `e${i}`, source: `n${a}`, target: `n${b}` })),
});

describe("reconcileGraphModel", () => {
  it("keeps node object identity across re-renders", () => {
    // This is the whole reason reconciliation exists: force-graph stores each
    // node's x/y ON the node object, so a fresh array every render resets the
    // layout and the graph visibly explodes on every keystroke.
    const render = renderLoop();
    const payload = build(3, [[0, 1]]);
    const first = render(payload).nodes;
    expect(render(payload).nodes[0]).toBe(first[0]);
  });

  it("reuses the object — and its position — for a node that survives", () => {
    const render = renderLoop();
    const kept = render(build(2)).nodes[0];
    kept.x = 42;

    const next = render(build(4));
    expect(next.nodes[0]).toBe(kept);
    expect(next.nodes[0].x).toBe(42);
  });

  it("evicts nodes that left the payload, so the cache does not grow", () => {
    const render = renderLoop();
    render(build(5));
    expect(render(build(2)).nodes).toHaveLength(2);
  });

  it("does not resurrect a node that left and came back with a stale position", () => {
    const render = renderLoop();
    render(build(2)).nodes[0].x = 99;
    render(build(0));
    expect(render(build(2)).nodes[0].x).toBeUndefined();
  });

  it("drops dangling edges and reports them", () => {
    const payload = build(2, [[0, 1]]);
    payload.edges.push({ id: "ghost", source: "n0", target: "missing" });
    const model = renderLoop()(payload);
    expect(model.links).toHaveLength(1);
    expect(model.loss.danglingEdges).toBe(1);
    expect(model.lossy).toBe(true);
  });

  it("counts every withheld edge exactly once, whichever cap took it", () => {
    // n0 is a hub; the node cap keeps it and drops the leaves, stranding their
    // edges. Those must be counted as capped, not lost silently.
    const payload = build(5, [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
    const model = renderLoop({ maxNodes: 2, maxEdges: 100 })(payload);
    expect(model.nodes).toHaveLength(2);
    expect(model.loss.cappedNodes).toBe(3);
    expect(model.loss.cappedEdges + model.links.length).toBe(4);
  });

  it("counts edges dropped by the edge cap", () => {
    const model = renderLoop({ maxNodes: 100, maxEdges: 2 })(
      build(4, [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ]),
    );
    expect(model.links).toHaveLength(2);
    expect(model.loss.cappedEdges).toBe(2);
  });

  it("reports no loss for a payload that fits", () => {
    const model = renderLoop()(build(3, [[0, 1]]));
    expect(model.lossy).toBe(false);
    expect(model.loss).toEqual({ danglingEdges: 0, cappedNodes: 0, cappedEdges: 0 });
  });
});

describe("selectConnectedCore", () => {
  it("returns everything untouched when the payload fits", () => {
    const payload = build(3, [[0, 1]]);
    expect(selectConnectedCore(payload.nodes, payload.edges, 10)).toBe(payload.nodes);
  });

  it("seeds at the biggest hub", () => {
    const payload = build(5, [
      [3, 0],
      [3, 1],
      [3, 2],
    ]);
    expect(selectConnectedCore(payload.nodes, payload.edges, 2)[0].id).toBe("n3");
  });

  it("keeps the result connected on a bipartite graph, where degree alone fails", () => {
    // Three hubs on one side, leaves on the other, and no hub touches another.
    // Ranking by degree alone would return h0,h1,h2 — three nodes, zero edges.
    const nodes = [
      { id: "h0" },
      { id: "h1" },
      { id: "h2" },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `l${i}` })),
    ];
    const edges = nodes
      .filter((n) => n.id.startsWith("l"))
      .map((leaf, i) => ({
        id: `e${i}`,
        source: `h${i % 3}`,
        target: leaf.id,
      }));

    const kept = selectConnectedCore(nodes, edges, 3);
    const keptIds = new Set(kept.map((n) => n.id));
    const induced = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));
    expect(kept).toHaveLength(3);
    expect(induced.length).toBeGreaterThan(0);
    // Every node bar the seed is adjacent to something already chosen.
    const touched = new Set(induced.flatMap((e) => [e.source, e.target]));
    expect(touched.size).toBe(3);
  });

  it("is deterministic — the retained set must not flicker between renders", () => {
    const payload = build(20, Array.from({ length: 15 }, (_, i): [number, number] => [i, i + 1]));
    const once = selectConnectedCore(payload.nodes, payload.edges, 8).map((n) => n.id);
    const twice = selectConnectedCore(payload.nodes, payload.edges, 8).map((n) => n.id);
    expect(once).toEqual(twice);
  });

  it("still fills the quota when the graph has no edges at all", () => {
    const payload = build(5);
    expect(selectConnectedCore(payload.nodes, payload.edges, 3)).toHaveLength(3);
  });

  it("spans disconnected components rather than stopping at the first", () => {
    const payload = build(6, [
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(selectConnectedCore(payload.nodes, payload.edges, 5)).toHaveLength(5);
  });
});
