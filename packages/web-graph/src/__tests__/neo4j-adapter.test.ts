import { describe, expect, it } from "vitest";
import { graphFromNeo4j } from "../adapters/neo4j.ts";

const node = (elementId: string, labels: string[], properties: Record<string, unknown> = {}) => ({
  elementId,
  labels,
  properties,
});

const rel = (elementId: string, type: string, start: string, end: string) => ({
  elementId,
  type,
  startNodeElementId: start,
  endNodeElementId: end,
  properties: {},
});

describe("graphFromNeo4j", () => {
  it("collects nodes and relationships out of flat record columns", () => {
    const result = graphFromNeo4j([
      {
        p: node("4:n:1", ["Person"], { name: "Ada" }),
        r: rel("5:r:1", "KNOWS", "4:n:1", "4:n:2"),
        q: node("4:n:2", ["Person"], { name: "Alan" }),
      },
    ]);
    expect(result.nodes.map((n) => n.id)).toEqual(["4:n:1", "4:n:2"]);
    expect(result.edges[0]).toMatchObject({ source: "4:n:1", target: "4:n:2", type: "KNOWS" });
  });

  it("dedupes an entity returned on many rows", () => {
    const ada = node("4:n:1", ["Person"], { name: "Ada" });
    const result = graphFromNeo4j([{ p: ada }, { p: ada }, { p: { ...ada } }]);
    expect(result.nodes).toHaveLength(1);
  });

  it("descends into lists and paths, which is what makes RETURN * work", () => {
    const result = graphFromNeo4j([
      {
        path: {
          // A driver Path exposes its parts under these keys.
          segments: [
            {
              start: node("4:n:1", ["Movie"]),
              relationship: rel("5:r:1", "ACTED_IN", "4:n:2", "4:n:1"),
              end: node("4:n:2", ["Person"]),
            },
          ],
        },
        extra: [node("4:n:3", ["Genre"])],
      },
    ]);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["4:n:1", "4:n:2", "4:n:3"]);
    expect(result.edges).toHaveLength(1);
  });

  it("normalizes a legacy Integer identity to the same string an edge references", () => {
    // Older drivers (and any JSON round-trip of them) express ids as
    // {low, high}. If nodes and edges normalized differently the edge would
    // dangle and silently vanish.
    const result = graphFromNeo4j([
      {
        a: { identity: { low: 7, high: 0 }, labels: ["Person"], properties: {} },
        b: { identity: { low: 8, high: 0 }, labels: ["Person"], properties: {} },
        r: {
          identity: { low: 99, high: 0 },
          type: "KNOWS",
          start: { low: 7, high: 0 },
          end: { low: 8, high: 0 },
          properties: {},
        },
      },
    ]);
    expect(result.nodes.map((n) => n.id)).toEqual(["7", "8"]);
    expect(result.edges[0]).toMatchObject({ id: "99", source: "7", target: "8" });
  });

  it("produces a valid, empty payload for a result with no graph entities", () => {
    const result = graphFromNeo4j([{ count: 5 }, { name: "Ada" }]);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.kind).toBe("foundry.graph");
  });

  it("terminates on a self-referential structure", () => {
    const cyclic: Record<string, unknown> = { n: node("4:n:1", ["Person"]) };
    cyclic.self = cyclic;
    expect(() => graphFromNeo4j([cyclic])).not.toThrow();
    expect(graphFromNeo4j([cyclic]).nodes).toHaveLength(1);
  });

  it("keeps the high word of a legacy Integer id", () => {
    // A Neo4j Integer is 64 bits split across two 32-bit words. Reading only
    // `low` makes every id past 2^32 collide with one below it — and a
    // collision does not fail, it points edges at the wrong nodes.
    const big = { low: 1, high: 1 }; // 2^32 + 1
    const small = { low: 1, high: 0 };
    const payload = graphFromNeo4j([
      { n: { identity: big, labels: ["A"], properties: { name: "far" } } },
      { m: { identity: small, labels: ["A"], properties: { name: "near" } } },
    ]);
    expect(payload.nodes).toHaveLength(2);
    expect(new Set(payload.nodes.map((node) => node.id)).size).toBe(2);
    expect(payload.nodes.map((node) => node.id)).toContain("4294967297");
  });

  it("prefers an elementId over a numeric identity on the same record", () => {
    const payload = graphFromNeo4j([
      { n: { elementId: "4:abc:7", low: 7, labels: ["A"], properties: {} } },
    ]);
    expect(payload.nodes[0]?.id).toBe("4:abc:7");
  });
});

describe("relationship-only results", () => {
  it("gives an edge its endpoints, so the graph is not empty", () => {
    // `MATCH ()-[r]->() RETURN r` is an ordinary query and the driver returns
    // no node objects at all. Without placeholders every edge dangles,
    // `pruneDanglingEdges` drops the lot, and a good result renders empty.
    const graph = graphFromNeo4j([
      {
        r: {
          identity: { low: 7, high: 0 },
          start: { low: 1, high: 0 },
          end: { low: 2, high: 0 },
          type: "ACTED_IN",
          properties: {},
        },
      },
    ]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(
      [graph.edges[0].source, graph.edges[0].target].sort(),
    );
  });

  it("lets a real node overwrite the placeholder it left behind", () => {
    const graph = graphFromNeo4j([
      {
        r: {
          identity: { low: 7, high: 0 },
          start: { low: 1, high: 0 },
          end: { low: 2, high: 0 },
          type: "ACTED_IN",
          properties: {},
        },
        m: {
          identity: { low: 2, high: 0 },
          labels: ["Movie"],
          properties: { title: "Metropolis" },
        },
      },
    ]);
    const target = graph.nodes.find((node) => node.id === graph.edges[0].target);
    expect(target?.properties?.title).toBe("Metropolis");
  });
});

describe("numeric identities", () => {
  const withIdentity = (identity: unknown) => ({
    identity,
    labels: ["Movie"],
    properties: { title: "Metropolis" },
  });

  it("takes a safe integer identity", () => {
    const result = graphFromNeo4j([[withIdentity(42)]]);
    expect(result.nodes.map((n) => n.id)).toEqual(["42"]);
  });

  it("refuses a number that has already lost precision", () => {
    // Past 2**53-1 the rounding happened before this code ran, so
    // `String(value)` faithfully stringifies the WRONG number and two distinct
    // ids collapse to one key — which does not fail, it attaches edges to the
    // wrong nodes. A caller with ids that large has exact forms available: a
    // string, a bigint, an elementId, or {low, high}.
    const result = graphFromNeo4j([[withIdentity(2 ** 53 + 2)]]);
    expect(result.nodes).toEqual([]);
  });

  it("still takes the exact forms for the same magnitude", () => {
    expect(graphFromNeo4j([[withIdentity(9007199254740993n)]]).nodes[0]?.id).toBe(
      "9007199254740993",
    );
    expect(graphFromNeo4j([[withIdentity({ low: 1, high: 1 })]]).nodes[0]?.id).toBe("4294967297");
  });
});
