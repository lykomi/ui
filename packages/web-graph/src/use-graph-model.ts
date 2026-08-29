import { useMemo, useRef } from "react";
import { pruneDanglingEdges, type GraphEdge, type GraphNode, type GraphPayload } from "./model.ts";

/**
 * A node handed to the force engine. force-graph WRITES to these objects —
 * `x`, `y`, `vx`, `vy` are the simulation's state, and `fx`/`fy` pin a node.
 */
export interface EngineNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

/** An edge handed to the engine. force-graph replaces the endpoint ids with
 *  the resolved node objects in place, hence the widened type. */
export interface EngineLink extends Omit<GraphEdge, "source" | "target"> {
  source: string | EngineNode;
  target: string | EngineNode;
}

/** Why the rendered graph is smaller than the payload. All zero is the happy path. */
export interface GraphModelLoss {
  /** Edges whose source or target was absent from the payload entirely. */
  danglingEdges: number;
  /** Nodes dropped by the node cap. */
  cappedNodes: number;
  /** Edges dropped — either stranded by the node cap, or over the edge cap. */
  cappedEdges: number;
}

export interface GraphModel {
  nodes: EngineNode[];
  links: EngineLink[];
  loss: GraphModelLoss;
  /** True when anything at all was withheld from the canvas. */
  lossy: boolean;
}

export interface GraphModelLimits {
  maxNodes: number;
  maxEdges: number;
}

/**
 * Caps chosen so an accidental `MATCH (n) RETURN n` degrades to a slow-but-alive
 * canvas instead of a frozen tab. Hosts with a known-small domain can raise them.
 */
export const DEFAULT_LIMITS: GraphModelLimits = { maxNodes: 1500, maxEdges: 3000 };

/**
 * Choose which nodes survive a cap: the connected core around the hubs.
 *
 * Which nodes survive decides whether the user sees a graph or confetti.
 *
 * Taking the first N in payload order keeps whatever the producer happened to
 * emit first — for an unbounded query that is close to random, and the
 * survivors are mostly unrelated, so the edges collapse with them.
 *
 * Taking the N highest-degree nodes is better but not enough. In a graph that
 * is even loosely bipartite — films and people, orders and customers — the hubs
 * all sit on one side and none of them are adjacent, so a small cap still
 * yields a set with no edges at all. (Measured: on an 8-film demo graph, top-5
 * by degree gave five films and zero relationships.)
 *
 * So: seed at the biggest hub and expand outwards through its neighbours,
 * preferring well-connected ones, then start again at the next unvisited hub.
 * Every node after the first seed is adjacent to one already chosen, so the
 * result is a handful of connected neighbourhoods rather than scattered dust.
 *
 * Mirrors `select_connected_core` in the Neo4j starter's `graph_payload.py`;
 * both sides cap, and they have to agree on what the important part of a graph
 * is.
 */
export function selectConnectedCore(
  nodes: GraphNode[],
  edges: GraphEdge[],
  limit: number,
): GraphNode[] {
  if (nodes.length <= limit) return nodes;

  const degree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    (adjacency.get(edge.source) ?? adjacency.set(edge.source, []).get(edge.source)!).push(
      edge.target,
    );
    (adjacency.get(edge.target) ?? adjacency.set(edge.target, []).get(edge.target)!).push(
      edge.source,
    );
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Payload order breaks ties, so identical data caps identically — an
  // unstable tiebreak makes the retained set flicker between renders.
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const better = (a: string, b: string) =>
    (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || (order.get(a) ?? 0) - (order.get(b) ?? 0);

  const ranked = [...order.keys()].sort(better);
  const chosen: GraphNode[] = [];
  const seen = new Set<string>();

  for (const seed of ranked) {
    if (chosen.length >= limit) break;
    if (seen.has(seed)) continue;
    const queue = [seed];
    seen.add(seed);
    while (queue.length > 0 && chosen.length < limit) {
      const current = queue.shift()!;
      const node = byId.get(current);
      if (node) chosen.push(node);
      const neighbours = (adjacency.get(current) ?? []).filter((id) => !seen.has(id)).sort(better);
      for (const neighbour of neighbours) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return chosen.slice(0, limit);
}

/**
 * Turn a payload into the mutable objects the force engine wants, REUSING the
 * object for any node whose id is already in `cache`.
 *
 * This is the single most important detail of driving force-graph. The
 * simulation stores each node's position ON the node object. Build a fresh
 * array every time — which `payload.nodes.map(...)` does — and every unrelated
 * re-render (a hover, a search keystroke) throws away all positions, so the
 * graph visibly explodes and re-settles. Reusing the object for an unchanged
 * node keeps its identity, and therefore its place.
 *
 * Pure, and it returns the next cache rather than mutating the one passed in:
 * the React binding is a thin wrapper below, and this stays testable — and
 * usable — without a renderer.
 *
 * Nodes absent from the new payload are dropped from the returned cache, so
 * this does not accumulate across successive queries.
 */
export function reconcileGraphModel(
  payload: GraphPayload,
  cache: ReadonlyMap<string, EngineNode>,
  limits: GraphModelLimits = DEFAULT_LIMITS,
): { model: GraphModel; cache: Map<string, EngineNode> } {
  {
    const {
      nodes: allNodes,
      edges: connectedEdges,
      dropped: danglingEdges,
    } = pruneDanglingEdges(payload);

    const keptNodes = selectConnectedCore(allNodes, connectedEdges, limits.maxNodes);
    const cappedNodes = allNodes.length - keptNodes.length;

    // Dropping nodes strands edges that were connected a moment ago, so the
    // edge set is re-filtered against the surviving nodes rather than reused.
    const keptIds = new Set(keptNodes.map((node) => node.id));
    const survivingEdges = connectedEdges.filter(
      (edge) => keptIds.has(edge.source) && keptIds.has(edge.target),
    );
    const keptEdges = survivingEdges.slice(0, limits.maxEdges);
    // Every edge that made it past the dangling prune but not onto the canvas,
    // whichever cap took it.
    const cappedEdges = connectedEdges.length - keptEdges.length;

    const next = new Map<string, EngineNode>();
    const nodes = keptNodes.map((node) => {
      const existing = cache.get(node.id);
      if (existing) {
        // Refresh the data fields in place; leave x/y/vx/vy/fx/fy alone —
        // those belong to the simulation, not to the payload.
        existing.labels = node.labels;
        existing.caption = node.caption;
        existing.properties = node.properties;
        next.set(node.id, existing);
        return existing;
      }
      const created: EngineNode = { ...node };
      next.set(node.id, created);
      return created;
    });

    const loss: GraphModelLoss = { danglingEdges, cappedNodes, cappedEdges };
    return {
      model: {
        nodes,
        // Links carry no simulation state we need to preserve — force-graph
        // resolves the endpoint ids to node objects itself on each data set —
        // so unlike nodes they can be rebuilt freely.
        links: keptEdges.map((edge) => ({ ...edge })),
        loss,
        lossy: danglingEdges > 0 || cappedNodes > 0 || cappedEdges > 0,
      },
      cache: next,
    };
  }
}

/**
 * A link's endpoint id, whichever form it is in.
 *
 * force-graph REPLACES an endpoint id with the node object once the simulation
 * has run, so anything reading endpoints after a render has to accept both —
 * comparing against `node.id` alone silently matches nothing.
 */
export function endpointId(end: unknown): string | undefined {
  if (typeof end === "string") return end;
  if (typeof end === "number") return String(end);
  if (typeof end === "object" && end !== null && "id" in end) {
    const id = (end as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return undefined;
}

/** React binding for {@link reconcileGraphModel}: holds the cache across renders. */
export function useGraphModel(
  payload: GraphPayload,
  limits: GraphModelLimits = DEFAULT_LIMITS,
): GraphModel {
  const cacheRef = useRef<Map<string, EngineNode>>(new Map());

  return useMemo(() => {
    const { model, cache } = reconcileGraphModel(payload, cacheRef.current, limits);
    cacheRef.current = cache;
    return model;
    // `limits` is an object literal at most call sites, so depend on its
    // fields rather than its identity — otherwise every render reconciles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, limits.maxNodes, limits.maxEdges]);
}
