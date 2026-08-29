import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import { GraphView, type GraphViewHandle } from "../graph-view.tsx";

/**
 * The handle is the AGENT's view of the graph, and it has one contract: what
 * it reports is what the user can see. jsdom takes the table path, which is
 * fine — the handle is installed either way, and the filtering it reports on
 * happens above the renderer.
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
const handle = createRef<GraphViewHandle>();

const hideLabel = (label: string) => {
  const chip = [...container.querySelectorAll("button")].find(
    (b) => b.getAttribute("title") === `Hide ${label}`,
  );
  expect(chip, `no legend chip for ${label}`).toBeTruthy();
  act(() => chip!.click());
};

beforeEach(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<GraphView data={payload} handleRef={handle} />));
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

describe("GraphViewHandle", () => {
  it("reports edge endpoints as ids", () => {
    // force-graph REPLACES `source`/`target` with the node objects once the
    // simulation has run, so handing the links out raw put whole simulation
    // objects — mutable layout fields and all — where the caller reads an id.
    // The engine does not run here (no canvas), so this pins the contract and
    // `endpointId` — the normalisation itself — is pinned in graph-model.
    const view = handle.current!.getViewState();
    expect(view.edges).toEqual([
      expect.objectContaining({ id: "e1", source: "n2", target: "n1", type: "DIRECTED" }),
    ]);
    for (const edge of view.edges) {
      expect(typeof edge.source).toBe("string");
      expect(typeof edge.target).toBe("string");
    }
  });

  it("reports only what is drawn once a label is filtered out", () => {
    hideLabel("Person");
    const view = handle.current!.getViewState();
    expect(view.nodes.map((n) => n.id)).toEqual(["n1"]);
    // The relationship goes with it — an arrow to a node that is not there
    // reads as a missing node rather than as a filter working.
    expect(view.edges).toEqual([]);
    expect(view.hiddenLabels).toEqual(["Person"]);
  });

  it("refuses to select a node the legend has hidden", () => {
    // Reporting success opens the drawer on something invisible, and the agent
    // then describes a node the user cannot see.
    expect(handle.current!.select("n2")).toBe(true);
    hideLabel("Person");
    expect(handle.current!.select("n2")).toBe(false);
    expect(handle.current!.select("n1")).toBe(true);
  });
});
