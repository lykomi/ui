import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { GraphInspector } from "../graph-inspector.tsx";
import { nodeTooltip } from "../graph-tooltip.ts";
import {
  GRAPH_PAYLOAD_KIND,
  GRAPH_PAYLOAD_VERSION,
  isGraphPayload,
  safeHref,
  type GraphNode,
} from "../model.ts";
import type { GraphStyleMap } from "../use-graph-styling.ts";

const statement: GraphNode = {
  id: "s1",
  labels: ["DocumentOrder", "EomiDerived", "EomiNode"],
  caption: "Precedence",
  details: [
    { label: "Quote", value: "they apply in this order" },
    { label: "Stated in", value: "Contract, 2.1", href: "/spaces/c1#b4" },
    { label: "Unsafe", value: "x", href: "javascript:alert(1)" },
  ],
  properties: { eomiKey: "platform/x:1", readings: 2 },
};

describe("curated details", () => {
  it("follows only http(s) and same-origin paths", () => {
    expect(safeHref("/spaces/c1#b4")).toBe("/spaces/c1#b4");
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("//evil.example/x")).toBeUndefined();
  });

  it("accepts details and rejects malformed ones", () => {
    const payload = (details: unknown) => ({
      kind: GRAPH_PAYLOAD_KIND,
      version: GRAPH_PAYLOAD_VERSION,
      nodes: [{ id: "a", details }],
      edges: [],
    });
    expect(isGraphPayload(payload(statement.details))).toBe(true);
    expect(isGraphPayload(payload([{ label: "Quote" }]))).toBe(false);
  });

  it("shows details first, links in a new tab, and the rest under Advanced", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <GraphInspector
            selection={{ node: statement, edge: null }}
            colorForLabel={() => "gray"}
            captionOf={() => "Precedence"}
            onClose={() => {}}
          />,
        ),
      );
      const links = [...host.querySelectorAll("a")];
      expect(links.map((a) => a.getAttribute("href"))).toEqual(["/spaces/c1#b4"]);
      expect(links[0].getAttribute("target")).toBe("_blank");
      expect(links[0].getAttribute("rel")).toContain("noopener");
      const advanced = host.querySelector("details")!;
      expect(advanced.open).toBe(false);
      expect(advanced.textContent).toContain("eomiKey");
      expect(host.querySelector("header")!.textContent).not.toContain("EomiDerived");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("hovers with the details, not the raw properties", () => {
    const styleMap = {
      styleForNode: () => ({ caption: "Precedence" }),
    } as unknown as GraphStyleMap;
    const text = nodeTooltip(statement, styleMap).textContent ?? "";
    expect(text).toContain("DocumentOrder — Precedence");
    expect(text).toContain("Quote: they apply in this order");
    expect(text).not.toContain("eomiKey");
    expect(text).not.toContain("EomiDerived");
  });
});

describe("details follow the data", () => {
  it("refreshes a kept node's details, and search finds their text", async () => {
    const { reconcileGraphModel } = await import("../use-graph-model.ts");
    const { __matchNodesForTest } = await import("../use-graph-view-state.ts");
    const payload = (value: string) => ({
      kind: GRAPH_PAYLOAD_KIND,
      version: GRAPH_PAYLOAD_VERSION,
      nodes: [{ id: "a", details: [{ label: "Quote", value }] }],
      edges: [],
    });
    const first = reconcileGraphModel(payload("old words"), new Map());
    const second = reconcileGraphModel(payload("new words"), first.cache);

    expect(second.model.nodes[0].details?.[0].value).toBe("new words");
    expect(__matchNodesForTest(second.model.nodes, "new wor", () => "")).toEqual(new Set(["a"]));
  });
});
