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
  it("keeps ONE handle object, live across view-state changes", () => {
    // `GraphPanel` stores `handleRef.current` in the workspace at connect time
    // and reconnects only when the payload, title or panel visibility change.
    // A handle rebuilt on every render therefore leaves the workspace — and
    // so every client tool — holding a closure over the view as it was when
    // the panel opened: `graph_get_view` answering without the search the
    // user has since typed, `graph_select_node` accepting a node hidden after
    // connection.
    const connected = handle.current!;

    act(() => {
      handle.current!.search("Fritz");
    });
    hideLabel("Movie");

    // Identity first: this is what the workspace holds.
    expect(handle.current).toBe(connected);
    // And it answers with the CURRENT view, not the one it was built with.
    const view = connected.getViewState();
    expect(view.query).toBe("Fritz");
    expect(view.hiddenLabels).toEqual(["Movie"]);
    expect(view.nodes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("drops a pin when its node leaves the payload", () => {
    // A pin is an id, and an id outlives the node it named. Left in the set, a
    // later graph carrying the same id gets that node frozen on arrival — by a
    // pin the user made for a different graph entirely.
    const pinButton = () =>
      [...container.querySelectorAll("button")].find(
        (b) => b.getAttribute("title") === "Unpin all nodes",
      );
    expect(pinButton()).toBeFalsy();

    act(() => {
      handle.current!.select("n2");
    });
    const freeze = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Freeze"),
    );
    expect(freeze, "no Freeze control on the drawer").toBeTruthy();
    act(() => freeze!.click());
    expect(pinButton(), "pin was not registered").toBeTruthy();

    // A graph that no longer has n2.
    act(() =>
      root.render(
        <GraphView
          data={{ ...payload, nodes: [payload.nodes[0]!], edges: [] }}
          handleRef={handle}
        />,
      ),
    );
    expect(pinButton(), "pin survived its node").toBeFalsy();
  });

  it("counts the DRAWN graph in the toolbar and the canvas label", () => {
    // A legend toggle is a primary control, so this is what a user sees every
    // time they use one: the toolbar said "2 nodes · 1 rels" beside a canvas
    // showing one node and nothing joining it, and the canvas `aria-label`
    // repeated the same wrong totals to a screen reader.
    expect(container.textContent).toContain("2 nodes · 1 rels");
    hideLabel("Person");
    expect(container.textContent).toContain("1 nodes · 0 rels");
  });

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

  it("counts search matches among the DRAWN nodes only", () => {
    // The toolbar states a number to the user. Counted from the payload, it
    // reported a match while every node on screen was dimmed and nothing was
    // found — whenever the only hit was one the legend hid or the cap dropped.
    const matchLabel = () =>
      [...container.querySelectorAll("span")]
        .map((el) => el.getAttribute("aria-label"))
        .find((label) => label?.includes("matching"));

    act(() => {
      handle.current!.search("Fritz");
    });
    expect(matchLabel()).toBe("1 matching node");
    hideLabel("Person");
    expect(matchLabel()).toBe("0 matching nodes");
  });

  it("says when the selection is no longer drawn, without dropping it", () => {
    // A legend filter is a view toggle, not a deletion: the drawer stays open
    // and its properties are what the user is reading. But `nodes` excludes
    // the node, so reporting the selection bare made the result contradict
    // itself.
    act(() => {
      handle.current!.select("n2");
    });
    expect(handle.current!.getViewState().selectionDrawn).toBe(true);
    hideLabel("Person");
    const view = handle.current!.getViewState();
    expect(view.selection?.id).toBe("n2");
    expect(view.selectionDrawn).toBe(false);
    expect(view.nodes.map((n) => n.id)).not.toContain("n2");
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
