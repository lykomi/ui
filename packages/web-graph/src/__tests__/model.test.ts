import { describe, expect, it } from "vitest";
import {
  GRAPH_PAYLOAD_KIND,
  GRAPH_PAYLOAD_VERSION,
  coerceGraphPayload,
  emptyGraphPayload,
  isGraphPayload,
  pruneDanglingEdges,
  resolveCaption,
  type GraphPayload,
} from "../model.ts";

const payload = (over: Partial<GraphPayload> = {}): GraphPayload => ({
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ id: "e1", source: "a", target: "b" }],
  ...over,
});

describe("isGraphPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(isGraphPayload(payload())).toBe(true);
    expect(isGraphPayload(emptyGraphPayload())).toBe(true);
  });

  it("rejects a lookalike without the discriminator", () => {
    // The whole point of `kind`: a tool result that happens to have nodes and
    // edges must not hijack the graph renderer.
    expect(isGraphPayload({ nodes: [], edges: [] })).toBe(false);
  });

  it("rejects an unknown version rather than rendering half of it", () => {
    expect(isGraphPayload({ ...payload(), version: 99 })).toBe(false);
  });

  it.each([null, undefined, 42, "graph", [], { kind: GRAPH_PAYLOAD_KIND }])(
    "rejects %p",
    (value) => {
      expect(isGraphPayload(value)).toBe(false);
    },
  );

  it("rejects malformed elements", () => {
    expect(isGraphPayload({ ...payload(), nodes: [{ id: "" }] })).toBe(false);
    expect(isGraphPayload({ ...payload(), edges: [{ id: "e", source: "a" }] })).toBe(false);
  });
});

describe("coerceGraphPayload", () => {
  it("accepts the payload directly", () => {
    expect(coerceGraphPayload(payload())).toEqual(payload());
  });

  it("parses a JSON string, and a double-encoded one", () => {
    // The AG-UI runner JSON.parses tool results once; a backend that returned
    // a JSON string then yields a string here, not an object.
    expect(coerceGraphPayload(JSON.stringify(payload()))).toEqual(payload());
    expect(coerceGraphPayload(JSON.stringify(JSON.stringify(payload())))).toEqual(payload());
  });

  it.each(["graph", "result", "data", "payload"])("unwraps a %s envelope", (key) => {
    expect(coerceGraphPayload({ [key]: payload() })).toEqual(payload());
  });

  it("returns null for anything else, instead of throwing", () => {
    expect(coerceGraphPayload("I found three people.")).toBeNull();
    expect(coerceGraphPayload("{ not json")).toBeNull();
    expect(coerceGraphPayload({ error: "boom" })).toBeNull();
    expect(coerceGraphPayload(null)).toBeNull();
  });

  it("terminates on a self-referential envelope", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.result = cyclic;
    expect(coerceGraphPayload(cyclic)).toBeNull();
  });
});

describe("resolveCaption", () => {
  it("prefers an explicit caption", () => {
    expect(resolveCaption({ id: "1", caption: "Ada", properties: { name: "X" } })).toBe("Ada");
  });

  it("honours a per-label caption key", () => {
    expect(resolveCaption({ id: "1", properties: { title: "Casablanca" } }, "title")).toBe(
      "Casablanca",
    );
  });

  it("falls back through the conventional keys", () => {
    expect(resolveCaption({ id: "1", properties: { name: "Ada" } })).toBe("Ada");
    expect(resolveCaption({ id: "1", properties: { title: "Casablanca" } })).toBe("Casablanca");
  });

  it("never returns empty — an unlabelled circle is unreadable", () => {
    expect(resolveCaption({ id: "node-7" })).toBe("node-7");
    expect(resolveCaption({ id: "node-7", properties: { name: "" } })).toBe("node-7");
  });

  it("skips a long property rather than captioning with an essay", () => {
    const long = "x".repeat(200);
    expect(resolveCaption({ id: "n", properties: { blob: long } })).toBe("n");
  });
});

describe("pruneDanglingEdges", () => {
  it("drops edges whose endpoints are absent and reports the count", () => {
    const result = pruneDanglingEdges(
      payload({ edges: [{ id: "e1", source: "a", target: "b" }, { id: "e2", source: "a", target: "ghost" }] }),
    );
    expect(result.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(result.dropped).toBe(1);
  });
});

describe("label colour assignment", () => {
  it("gives a label the same colour regardless of which other labels are present", async () => {
    // Colour has to mean the same thing across queries, or the legend must be
    // re-read every time and no mental model of the graph ever forms.
    const { __buildLabelColorsForTest } = await import("../use-graph-styling.ts");
    const { FALLBACK_THEME } = await import("../theme.ts");
    const palette = FALLBACK_THEME.palette;
    const a = __buildLabelColorsForTest(["Person", "Movie", "Genre"], palette, undefined);
    const b = __buildLabelColorsForTest(["Movie", "Genre", "Person", "Studio"], palette, undefined);
    for (const label of ["Person", "Movie", "Genre"]) {
      expect(b.get(label), `${label} changed colour between queries`).toBe(a.get(label));
    }
  });

  it("never gives two labels in one graph the same colour", async () => {
    const { __buildLabelColorsForTest } = await import("../use-graph-styling.ts");
    const { FALLBACK_THEME } = await import("../theme.ts");
    const labels = ["Person", "Movie", "Genre", "Studio", "Award", "Country"];
    const colors = __buildLabelColorsForTest(labels, FALLBACK_THEME.palette, undefined);
    expect(new Set(colors.values()).size).toBe(labels.length);
  });

  it("lets an explicit override win", async () => {
    const { __buildLabelColorsForTest } = await import("../use-graph-styling.ts");
    const { FALLBACK_THEME } = await import("../theme.ts");
    const colors = __buildLabelColorsForTest(["Person"], FALLBACK_THEME.palette, {
      Person: "#123456",
    });
    expect(colors.get("Person")).toBe("#123456");
  });
});
