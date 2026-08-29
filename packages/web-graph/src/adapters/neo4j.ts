/**
 * Neo4j → {@link GraphPayload}.
 *
 * The ONLY module in this package that knows Neo4j exists. Everything under
 * `src/` outside `adapters/` stays store-agnostic; `src/__tests__/no-store-leak.test.ts`
 * enforces that, so the visualizer keeps working for callers who have never
 * heard of Cypher.
 *
 * This mirrors the server-side mapping the `neo4j-aura` starter preset does in
 * `agent/app/graph_payload.py`. Most apps will not need it — their backend
 * already emits the payload. It exists for the ones that query Neo4j straight
 * from the browser (an HTTP Query API call, a fixture, a test).
 */

import {
  GRAPH_PAYLOAD_KIND,
  GRAPH_PAYLOAD_VERSION,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "../model.ts";

/**
 * Structural shape of a driver node. Deliberately NOT the driver's own type —
 * importing `neo4j-driver` for a type would put a store client in the
 * dependency tree of a visualization package. Anything with these fields
 * works, including the plain JSON the HTTP Query API returns.
 */
export interface Neo4jNodeLike {
  elementId?: string;
  identity?: unknown;
  labels?: string[];
  properties?: Record<string, unknown>;
}

export interface Neo4jRelationshipLike {
  elementId?: string;
  identity?: unknown;
  type?: string;
  start?: unknown;
  end?: unknown;
  startNodeElementId?: string;
  endNodeElementId?: string;
  properties?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Normalize an id. The driver hands back `elementId` (a string) on modern
 * versions and `identity` (an Integer object, or a bigint) on older ones;
 * JSON round-trips turn the latter into `{low, high}`. All of them have to
 * collapse to the same string, or edges stop matching their nodes.
 */
function toId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (isRecord(value)) {
    // An elementId is exact; prefer it whenever the record carries one.
    if (typeof value.elementId === "string" && value.elementId.length > 0) {
      return value.elementId;
    }
    if (typeof value.low === "number") {
      // A Neo4j Integer is a 64-bit value split across two 32-bit words, and
      // `low` alone is only the bottom half. Dropping `high` makes every id
      // past 2^32 collide with one below it — and a collision here does not
      // fail, it silently points edges at the wrong nodes. BigInt, because
      // the whole point is values a double cannot hold exactly.
      const low = BigInt(value.low >>> 0);
      const high = typeof value.high === "number" ? BigInt(value.high) : 0n;
      return String((high << 32n) + low);
    }
  }
  return null;
}

export const isNeo4jNode = (value: unknown): value is Neo4jNodeLike =>
  isRecord(value) &&
  Array.isArray(value.labels) &&
  toId(value.elementId ?? value.identity) !== null;

export const isNeo4jRelationship = (value: unknown): value is Neo4jRelationshipLike =>
  isRecord(value) &&
  typeof value.type === "string" &&
  toId(value.elementId ?? value.identity) !== null &&
  toId(value.startNodeElementId ?? value.start) !== null &&
  toId(value.endNodeElementId ?? value.end) !== null;

export function toGraphNode(node: Neo4jNodeLike): GraphNode | null {
  const id = toId(node.elementId ?? node.identity);
  if (id === null) return null;
  return {
    id,
    labels: node.labels ?? [],
    properties: node.properties ?? {},
  };
}

export function toGraphEdge(rel: Neo4jRelationshipLike): GraphEdge | null {
  const id = toId(rel.elementId ?? rel.identity);
  const source = toId(rel.startNodeElementId ?? rel.start);
  const target = toId(rel.endNodeElementId ?? rel.end);
  if (id === null || source === null || target === null) return null;
  return {
    id,
    source,
    target,
    type: rel.type,
    properties: rel.properties ?? {},
  };
}

/**
 * Walk arbitrary Cypher result rows and collect every node and relationship,
 * however deeply nested.
 *
 * A row is whatever the query returned: bare entities, a path object, a list
 * from `collect()`, a map from a projection. Rather than enumerate those
 * shapes, this recurses and picks out anything that looks like an entity —
 * which is what makes `RETURN *` work as well as a careful projection.
 *
 * Duplicates collapse by id: the same node returned on ten rows is one node.
 */
export function graphFromNeo4j(rows: unknown): GraphPayload {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const seen = new Set<object>();

  const visit = (value: unknown, depth: number): void => {
    if (value === null || value === undefined || depth > 12) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    // Cycle guard: paths reference their own segments' nodes.
    if (seen.has(value)) return;
    seen.add(value);

    if (isNeo4jNode(value)) {
      const node = toGraphNode(value);
      if (node) nodes.set(node.id, node);
      return;
    }
    if (isNeo4jRelationship(value)) {
      const edge = toGraphEdge(value);
      if (edge) edges.set(edge.id, edge);
      return;
    }
    for (const nested of Object.values(value)) visit(nested, depth + 1);
  };

  visit(rows, 0);

  return {
    kind: GRAPH_PAYLOAD_KIND,
    version: GRAPH_PAYLOAD_VERSION,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}
