import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@iloveagents/foundry-web-ui";
import {
  GRAPH_SELECTION_CONTEXT_KEY,
  GraphContextPinButton,
  syncGraphSelectionContext,
  syncGraphEdgeContext,
} from "../assistant-ui/graph-context.tsx";
import type { GraphNode } from "../model.ts";

/**
 * Pin, then unpin, and the node has to come back into the conversation NAMED
 * the way it is named on the canvas.
 *
 * Unpinning rebuilds the tracking item from scratch, and the caption key is
 * not recoverable from the pinned item — so the rebuild has to be handed it,
 * or the chip the user reads and the `preview` the agent reads both revert to
 * a default caption that may appear nowhere on screen. Four separate paths in
 * this package have shipped that bug; this is the one that survived longest,
 * because the chip only goes wrong after a round trip through the pin.
 */
const node: GraphNode = {
  id: "n1",
  labels: ["Film"],
  properties: { title: "A Working Title", originalTitle: "Le Film" },
};

const items = () => useAppStore.getState().contextItems;
const tracked = () => items().find((item) => item.key === GRAPH_SELECTION_CONTEXT_KEY);

let container: HTMLDivElement;
let root: Root;
let priorActEnvironment: unknown;

beforeEach(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useAppStore.setState({ contextItems: [] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
});

const click = () => act(() => container.querySelector("button")?.click());

describe("GraphContextPinButton", () => {
  it("restores the payload's caption when the pin is removed", () => {
    syncGraphSelectionContext(node, "graph:Films", "originalTitle");
    expect(tracked()?.label).toBe("Film · Le Film");

    act(() => root.render(<GraphContextPinButton node={node} captionKey="originalTitle" />));

    // Pin: the keyed item is promoted, so it loses its key and survives
    // selecting elsewhere.
    click();
    expect(tracked()).toBeUndefined();
    expect(items()).toHaveLength(1);
    expect(items()[0]?.label).toBe("Film · Le Film");

    // Unpin: the pin goes, and the tracking item comes back — with the
    // caption the canvas paints, not `title`.
    click();
    expect(items()).toHaveLength(1);
    expect(tracked()?.label).toBe("Film · Le Film");
    expect((tracked()?.payload as { preview?: string })?.preview).toBe("Le Film");
    expect(tracked()?.sourcePage).toBe("graph:Films");
  });
});

it("tracks a relationship with direction and properties, then clears it on deselection", () => {
  syncGraphEdgeContext(
    {
      id: "edge1",
      source: "higher",
      target: "lower",
      type: "PREVAILS_OVER",
      properties: { clause: "3" },
    },
    "graph:Contract",
  );
  const selected = items().find((item) => item.key === "graph.edge-selection");
  expect(selected?.payload).toMatchObject({
    refType: "graph-relationship",
    refId: "edge1",
    meta: { source: "higher", target: "lower", type: "PREVAILS_OVER", properties: { clause: "3" } },
  });
  syncGraphEdgeContext(null, "graph:Contract");
  expect(items().find((item) => item.key === "graph.edge-selection")).toBeUndefined();
});
