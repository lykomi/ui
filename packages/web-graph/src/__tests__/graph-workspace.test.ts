import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";
import {
  _resetGraphWorkspace,
  findWorkspaceNode,
  graphWorkspaceStore,
  isAmbiguous,
  isGraphOpen,
} from "../graph-workspace.ts";
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
  reveal: vi.fn(),
  search: vi.fn(),
  select: vi.fn(() => true),
  unpinAll: vi.fn(),
  getViewState: vi.fn(() => ({ selection: null, query: "", hiddenLabels: [] })),
});

beforeEach(() => {
  _resetGraphWorkspace();
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

  it("finds a node by the caption the CANVAS draws, not an approximation", () => {
    // A local caption rule (caption / name / title) left every other way a
    // node gets its caption — a producer's `legend.captionKey`, `displayName`,
    // `label`, the first short string property — visible on screen and
    // unselectable by the text on it.
    graphWorkspaceStore.getState().connect(handle(), "t", {
      ...payload,
      legend: { Film: { captionKey: "originalTitle" } },
      nodes: [
        { id: "k", labels: ["Film"], properties: { originalTitle: "Der müde Tod", title: "x" } },
        { id: "d", properties: { displayName: "Destiny" } },
      ],
      edges: [],
    });
    expect(findWorkspaceNode("Der müde Tod")?.id).toBe("k");
    expect(findWorkspaceNode("Destiny")?.id).toBe("d");
  });

  it("refuses a blank selector instead of picking the first node", () => {
    // Every caption `.includes("")`, so a missing or whitespace-only argument
    // used to come back as a confident selection of whatever happened to be
    // first — and the agent would then describe it to the user.
    expect(findWorkspaceNode("")).toBeNull();
    expect(findWorkspaceNode("   ")).toBeNull();
  });

  it("drops a selection that does not belong to the newly connected graph", () => {
    // React mounts a replacement panel before unmounting the old one, and
    // `disconnect` no-ops once a newer panel has claimed the workspace — so
    // without this the old graph's selection is what `graph_get_view` reports.
    graphWorkspaceStore.getState().connect(handle(), "First", payload);
    graphWorkspaceStore.getState().setSelection(payload.nodes[0]);

    const other: GraphPayload = { ...payload, nodes: [{ id: "zzz" }], edges: [] };
    graphWorkspaceStore.getState().connect(handle(), "Second", other);
    expect(graphWorkspaceStore.getState().selection).toBeNull();
  });

  it("keeps a selection that survives into the new payload", () => {
    // A merge re-connects the SAME panel with a bigger payload. Clearing here
    // would drop the user's selection every time the agent expanded a node.
    const only = handle();
    graphWorkspaceStore.getState().connect(only, "Graph", payload);
    graphWorkspaceStore.getState().setSelection(payload.nodes[0]);

    const grown: GraphPayload = { ...payload, nodes: [...payload.nodes, { id: "n9" }] };
    graphWorkspaceStore.getState().connect(only, "Graph", grown);
    expect(graphWorkspaceStore.getState().selection?.id).toBe(payload.nodes[0].id);
  });
});

describe("an ambiguous caption is a question, not a guess", () => {
  const payload = {
    kind: GRAPH_PAYLOAD_KIND,
    version: GRAPH_PAYLOAD_VERSION,
    nodes: [
      { id: "p1", labels: ["Person"], properties: { name: "John Smith" } },
      { id: "p2", labels: ["Person"], properties: { name: "John Smith" } },
      { id: "m1", labels: ["Movie"], properties: { title: "Solo" } },
    ],
    edges: [],
  } as const;

  beforeEach(() => {
    _resetGraphWorkspace();
    graphWorkspaceStore.setState({ payload: payload as never });
  });

  it("refuses to pick one of two nodes with the same caption", () => {
    // Duplicate names are ordinary in a real graph, and `find` answered with
    // whichever the producer returned first — a confident wrong selection the
    // user has no way to see.
    const match = findWorkspaceNode("John Smith");
    expect(isAmbiguous(match)).toBe(true);
    if (isAmbiguous(match)) {
      expect(match.ambiguous.map((n) => n.id).sort()).toEqual(["p1", "p2"]);
    }
  });

  it("still answers when the caption identifies exactly one", () => {
    expect((findWorkspaceNode("Solo") as { id?: string })?.id).toBe("m1");
  });

  it("answers by id even when the caption is ambiguous", () => {
    expect((findWorkspaceNode("p2") as { id?: string })?.id).toBe("p2");
  });

  it("treats a partial term matching several as ambiguous too", () => {
    const match = findWorkspaceNode("john");
    expect(isAmbiguous(match)).toBe(true);
  });
});
