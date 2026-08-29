import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import { GraphView } from "../graph-view.tsx";

/**
 * The readable table is the fallback for "there is nothing to draw on", and
 * jsdom is the environment that matters: it DEFINES `HTMLCanvasElement` and
 * then refuses to give a 2D context, so a check for the class picked the
 * engine path and a consumer's test hit unimplemented canvas APIs instead of
 * the table this exists to give them.
 */
const payload: GraphPayload = {
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: [
    { id: "n1", labels: ["Movie"], properties: { title: "Metropolis" } },
    { id: "n2", labels: ["Person"], properties: { name: "Fritz Lang" } },
  ],
  edges: [{ id: "e1", source: "n2", target: "n1", type: "DIRECTED" }],
};

let container: HTMLDivElement;
let root: Root;
let priorActEnvironment: unknown;

beforeEach(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (priorActEnvironment === undefined) {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT;
  } else {
    globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
  }
});

describe("GraphView without a usable canvas", () => {
  it("renders the readable table, nodes and relationships both", () => {
    act(() => root.render(<GraphView data={payload} />));

    const tables = container.querySelectorAll("table");
    expect(tables.length).toBe(2);
    expect(container.textContent).toContain("Metropolis");
    expect(container.textContent).toContain("Fritz Lang");
    // The relationship table is what makes the topology readable at all.
    expect(container.textContent).toContain("DIRECTED");
  });

  it("offers no table toggle where there is no canvas to go back to", () => {
    act(() => root.render(<GraphView data={payload} />));
    // The legend chips carry `aria-pressed` too, so this looks for the
    // toggle's own label rather than the attribute.
    const titles = [...container.querySelectorAll("button")].map((b) => b.getAttribute("title"));
    expect(titles).not.toContain("Show the graph");
    expect(titles).not.toContain("Show as a table");
  });
});
