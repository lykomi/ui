import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { edgeTooltip, nodeTooltip } from "../graph-tooltip.ts";
import type { GraphStyleMap } from "../use-graph-styling.ts";

const styleMap = {
  styleForNode: (node: { properties?: Record<string, unknown> }) => ({
    caption: String(node.properties?.name ?? "node"),
  }),
  nameForLabel: (label: string) => (label === "DocumentOrder" ? "Order of precedence" : label),
} as unknown as GraphStyleMap;

describe("the hover tooltip", () => {
  it("names the kind, then the caption, then label/value rows", () => {
    const tip = nodeTooltip(
      {
        id: "n1",
        labels: ["DocumentOrder"],
        properties: { name: "Precedence" },
        details: [
          { label: "Order", value: "Contract > Addendum No. 1" },
          { label: "Quote", value: "In case of inconsistency …" },
        ],
      },
      styleMap,
    );

    expect(tip.querySelector(".foundry-graph-tip__kind")?.textContent).toBe("Order of precedence");
    expect(tip.querySelector(".foundry-graph-tip__title")?.textContent).toBe("Precedence");
    const keys = [...tip.querySelectorAll(".foundry-graph-tip__key")].map((k) => k.textContent);
    expect(keys).toEqual(["Order", "Quote"]);
  });

  it("leaves links to the drawer, since a card that follows the cursor cannot be clicked", () => {
    const tip = nodeTooltip(
      {
        id: "n1",
        labels: ["DocumentOrder"],
        properties: { name: "Precedence" },
        details: [
          { label: "Status", value: "Agreed" },
          { label: "Source", value: "Open at the passage", href: "/spaces/x" },
        ],
      },
      styleMap,
      { clickShowsDetails: true },
    );

    const keys = [...tip.querySelectorAll(".foundry-graph-tip__key")].map((k) => k.textContent);
    expect(keys).toEqual(["Status"]);
    expect(tip.textContent).not.toContain("Open at the passage");
    expect(tip.querySelector(".foundry-graph-tip__hint")?.textContent).toBe("Click for details");
  });

  it("promises no click where no details drawer opens (the inline card)", () => {
    const node = {
      id: "n1",
      labels: ["DocumentOrder"],
      properties: { name: "Precedence" },
      details: [{ label: "Source", value: "Open at the passage", href: "/spaces/x" }],
    };

    const tip = nodeTooltip(node, styleMap);
    expect(tip.querySelector(".foundry-graph-tip__hint")).toBeNull();
    // With no drawer to carry it, the link's row stays readable, as text.
    expect(tip.querySelector(".foundry-graph-tip__key")?.textContent).toBe("Source");
    expect(tip.querySelector("a")).toBeNull();
  });

  it("takes every colour from the theme's classes, never an inline style", () => {
    const tip = nodeTooltip(
      { id: "n1", labels: ["Clause"], properties: { name: "9.1", text: "Liability" } },
      styleMap,
    );

    for (const element of [tip, ...tip.querySelectorAll<HTMLElement>("*")]) {
      expect(element.getAttribute("style")).toBeNull();
    }
  });

  it("keeps its hierarchy in utilities, so it needs no optional stylesheet", () => {
    const tip = nodeTooltip(
      {
        id: "n1",
        labels: ["DocumentOrder"],
        properties: { name: "Precedence" },
        details: [{ label: "A producer's very long label for one row", value: "x" }],
      },
      styleMap,
    );
    const classes = (name: string) =>
      tip.querySelector(`.foundry-graph-tip__${name}`)?.className.split(" ") ?? [];

    expect(classes("kind")).toEqual(expect.arrayContaining(["uppercase", "text-muted-foreground"]));
    expect(classes("title")).toContain("font-semibold");
    expect(classes("rows")).toContain("grid");
    // A long label wraps inside the card instead of widening it.
    expect(classes("key")).toContain("max-w-32");
    expect(classes("key")).not.toContain("whitespace-nowrap");
  });

  it("keeps markup in a caption as text", () => {
    const tip = edgeTooltip({
      id: "e1",
      source: "a",
      target: "b",
      type: "AMENDS",
      properties: { note: "<img src=x onerror=alert(1)>" },
    });

    expect(tip.querySelector("img")).toBeNull();
    expect(tip.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("the tooltip's stylesheet", () => {
  const css = readFileSync(resolve(__dirname, "../styles.css"), "utf8");
  const rule = /\.float-tooltip-kap\.float-tooltip-kap\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  it("outranks float-tooltip's injected sheet, whatever the load order", () => {
    // float-tooltip injects `.float-tooltip-kap { background: rgba(0,0,0,0.6) }`
    // at runtime, after this file: a single class lost every tie to it.
    expect(rule).not.toBe("");
  });

  it("is an opaque surface of the theme's tokens", () => {
    expect(rule).toMatch(/background:\s*var\(--popover,\s*Canvas\)/);
    expect(rule).toMatch(/color:\s*var\(--popover-foreground,\s*CanvasText\)/);
    expect(rule).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.\d/);
  });
});
