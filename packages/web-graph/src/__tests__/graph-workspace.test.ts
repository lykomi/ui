import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRAPH_PAYLOAD_KIND,
  GRAPH_PAYLOAD_VERSION,
  type GraphPayload,
} from "../model.ts";
import { findWorkspaceNode, graphWorkspaceStore, isGraphOpen } from "../graph-workspace.ts";
import type { GraphViewHandle } from "../graph-view.tsx";

const payload: GraphPayload = {
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: [
    { id: "n1", labels: ["Movie"], properties: { title: "Metropolis" } },
    { id: "n2", labels: ["Person"], properties: { name: "Fritz Lang" } },
    { id: "n3", labels: ["Person"], caption: "Brigitte Helm" },
  ],
  edges: [{ id: "e1", source: "n2", target: "n1", type: "DIRECTED" }],
};

const handle = (): GraphViewHandle => ({
  zoomToFit: vi.fn(),
  centerOn: vi.fn(),
  search: vi.fn(),
  select: vi.fn(),
  unpinAll: vi.fn(),
});

beforeEach(() => {
  graphWorkspaceStore.setState({
    handle: null,
    title: null,
    payload: null,
    selection: null,
    query: "",
  });
});

describe("graph workspace", () => {
  it("reports whether a graph is open", () => {
    expect(isGraphOpen()).toBe(false);
    graphWorkspaceStore.getState().connect(handle(), "Cast", payload);
    expect(isGraphOpen()).toBe(true);
  });

  it("keeps the newest panel when an older one unmounts after it", () => {
    // React mounts the replacement before unmounting the old tree, so the
    // disconnect for panel A arrives AFTER panel B has connected. Without the
    // identity check that stale cleanup blanks the live workspace and the
    // agent's tools start reporting "no graph is open".
    const first = handle();
    const second = handle();
    const store = graphWorkspaceStore.getState();
    store.connect(first, "first", payload);
    store.connect(second, "second", payload);
    store.disconnect(first);

    expect(graphWorkspaceStore.getState().handle).toBe(second);
    expect(graphWorkspaceStore.getState().title).toBe("second");
  });

  it("clears when the live panel unmounts", () => {
    const live = handle();
    graphWorkspaceStore.getState().connect(live, "Cast", payload);
    graphWorkspaceStore.getState().disconnect(live);
    expect(isGraphOpen()).toBe(false);
  });
});

describe("findWorkspaceNode", () => {
  beforeEach(() => graphWorkspaceStore.getState().connect(handle(), "Cast", payload));

  it("finds by id", () => {
    expect(findWorkspaceNode("n1")?.id).toBe("n1");
  });

  it("finds by caption, which is how the agent refers to a node", () => {
    // The agent says "select Metropolis"; it has never seen an element id.
    expect(findWorkspaceNode("Metropolis")?.id).toBe("n1");
    expect(findWorkspaceNode("fritz lang")?.id).toBe("n2");
    expect(findWorkspaceNode("Brigitte Helm")?.id).toBe("n3");
  });

  it("prefers an exact caption over a partial one", () => {
    graphWorkspaceStore.getState().connect(handle(), "t", {
      ...payload,
      nodes: [
        { id: "long", properties: { name: "Metropolis Restored Edition" } },
        { id: "exact", properties: { name: "Metropolis" } },
      ],
    });
    expect(findWorkspaceNode("Metropolis")?.id).toBe("exact");
  });

  it("falls back to a partial match", () => {
    expect(findWorkspaceNode("Fritz")?.id).toBe("n2");
  });

  it("returns null rather than guessing", () => {
    expect(findWorkspaceNode("Nosferatu")).toBeNull();
  });
});
