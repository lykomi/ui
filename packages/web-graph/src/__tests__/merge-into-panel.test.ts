import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToolPanelStore } from "@lykomi/web-ui";

import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import { _resetGraphWorkspace, graphWorkspaceStore } from "../graph-workspace.ts";
import { mergeIntoOpenGraph } from "../assistant-ui/merge-into-panel.ts";
import { graphPanelContent, graphPanelPayload } from "../assistant-ui/graph-panel-content.ts";
import type { GraphViewHandle } from "../graph-view.tsx";

const graph = (nodes: GraphPayload["nodes"], edges: GraphPayload["edges"] = []): GraphPayload => ({
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes,
  edges,
});

const handle = (): GraphViewHandle => ({
  zoomToFit: vi.fn(),
  centerOn: vi.fn(),
  reveal: vi.fn(),
  search: vi.fn(),
  select: vi.fn(() => true),
  unpinAll: vi.fn(),
  getViewState: vi.fn(() => ({ selection: null, query: "", hiddenLabels: [] })),
});

const open = (payload: GraphPayload) => {
  graphWorkspaceStore.getState().connect(handle(), "Graph", payload);
  useToolPanelStore.getState().openPanel(graphPanelContent("Graph", payload) as never);
};

// The merge writes to the PANEL; the mounted panel is what re-publishes the
// result as the workspace. There is no React here, so read the panel.
const onScreen = () => graphPanelPayload(useToolPanelStore.getState().content as never);

beforeEach(() => {
  _resetGraphWorkspace();
  useToolPanelStore.getState().closePanel();
});

describe("mergeIntoOpenGraph", () => {
  it("does nothing when no graph panel is open", () => {
    expect(mergeIntoOpenGraph(graph([{ id: "a" }]))).toBe(false);
  });

  it("refuses a result that shares nothing with what is on screen", () => {
    // Without the overlap test an unrelated query grafts itself onto someone
    // else's workspace.
    open(graph([{ id: "a" }]));
    expect(mergeIntoOpenGraph(graph([{ id: "z" }]))).toBe(false);
  });

  it("folds in an expansion that touches the open graph", () => {
    open(graph([{ id: "a" }]));
    expect(
      mergeIntoOpenGraph(
        graph([{ id: "a" }, { id: "b" }], [{ id: "e", source: "a", target: "b" }]),
      ),
    ).toBe(true);
    expect(
      onScreen()
        ?.nodes.map((node) => node.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("folds in a write that only CHANGED a node it already has", () => {
    // `MATCH (n) SET n.status = $status RETURN n` returns nothing new — every
    // id is already on screen. Testing ids alone threw the result away and
    // left the details drawer showing the old value of the property the user
    // had just changed.
    open(graph([{ id: "a", properties: { status: "draft" } }]));
    expect(mergeIntoOpenGraph(graph([{ id: "a", properties: { status: "final" } }]))).toBe(true);
    expect(onScreen()?.nodes[0].properties?.status).toBe("final");
  });

  it("stays put when the result is identical, so the panel does not churn", () => {
    open(graph([{ id: "a", properties: { status: "draft" } }]));
    expect(mergeIntoOpenGraph(graph([{ id: "a", properties: { status: "draft" } }]))).toBe(false);
  });
});
