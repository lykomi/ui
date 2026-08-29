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
