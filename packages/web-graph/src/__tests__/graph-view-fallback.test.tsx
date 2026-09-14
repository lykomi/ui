import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("lets a relationship be opened from the table, not only from the canvas", () => {
    // The drawer has handled edges since it was written; only the canvas could
    // reach them. This table IS the accessibility surface, so without a
    // control here a keyboard user could read that a relationship exists and
    // never see one of its properties, while a mouse user clicks the same
    // line and gets all of them.
    act(() => root.render(<GraphView data={payload} />));

    const typeButton = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "DIRECTED",
    );
    expect(typeButton, "no control on the relationship row").toBeTruthy();

    act(() => typeButton!.click());
    // The inspector opens on the relationship and shows what it carries.
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

it("requests fullscreen from the graph surface and reports a rejected request", async () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
  const request = vi.fn().mockRejectedValue(new Error("Unavailable"));
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: request,
  });
  try {
    await act(async () => root.render(<GraphView data={payload} />));
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Fullscreen"]')!.click(),
    );
    expect(request).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Fullscreen could not open",
    );
    expect(container.querySelector('[title="Zoom to fit"]')).not.toBeNull();
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", original);
    else
      delete (HTMLElement.prototype as unknown as { requestFullscreen?: unknown })
        .requestFullscreen;
  }
});
