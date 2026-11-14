import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION, type GraphPayload } from "../model.ts";

/**
 * The watcher's whole job is knowing which results are NEW. Everything else it
 * does is delegated, so this is what is worth pinning.
 */
const thread = vi.hoisted(() => ({
  messages: [] as unknown[],
  threadId: "t1" as string | undefined,
}));
// Only `useAuiState` is replaced: the web-ui barrel this file reaches through
// registers its own tool UIs at import time and needs the real
// `makeAssistantToolUI`.
vi.mock("@assistant-ui/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@assistant-ui/react")>()),
  useAuiState: (selector: (s: unknown) => unknown) => selector({ thread }),
}));

const visibility = vi.hoisted(() => ({ foreground: true }));
vi.mock("@lykomi/web-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lykomi/web-ui")>()),
  useIsForegroundChat: () => visibility.foreground,
}));

const merged = vi.hoisted(() => ({ calls: [] as GraphPayload[] }));
vi.mock("../assistant-ui/merge-into-panel.ts", () => ({
  mergeIntoOpenGraph: (payload: GraphPayload) => {
    merged.calls.push(payload);
    return true;
  },
}));

const { GraphResultSeeder } = await import("../assistant-ui/graph-result-seeder.tsx");
const { useToolPanelStore } = await import("@lykomi/web-ui");
const { _resetGraphToolBindings, registerGraphTool } =
  await import("../assistant-ui/graph-tool-registry.ts");
const { graphPanelContent } = await import("../assistant-ui/graph-panel-content.ts");
const { coerceGraphPayload } = await import("../model.ts");

const graph = (id: string): GraphPayload => ({
  kind: GRAPH_PAYLOAD_KIND,
  version: GRAPH_PAYLOAD_VERSION,
  nodes: [{ id }],
  edges: [],
});

const call = (toolCallId: string, id: string) => ({
  parts: [
    { type: "tool-call", toolName: "graph_expand_node", toolCallId, args: {}, result: graph(id) },
  ],
});

const openGraphPanel = () =>
  useToolPanelStore.setState({ isOpen: true, content: graphPanelContent("Graph", graph("seed")) });

let container: HTMLDivElement;
let root: Root;
let priorActEnvironment: unknown;

const render = () => act(() => root.render(<GraphResultSeeder />));

beforeEach(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  merged.calls = [];
  visibility.foreground = true;
  thread.messages = [];
  thread.threadId = "t1";
  // A merge needs somewhere to merge INTO, and that somewhere has to be a
  // GRAPH. The seeder holds a result back while no graph panel is up rather
  // than marking it handled, so these tests would otherwise assert against a
  // deliberately deferred no-op.
  openGraphPanel();
  _resetGraphToolBindings();
  registerGraphTool({
    toolName: "graph_expand_node",
    title: "Expand node",
    extract: (result) => coerceGraphPayload(result),
    autoOpenPanel: false,
  });
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

describe("GraphResultSeeder", () => {
  it("never applies background results to the foreground graph, including after return", () => {
    thread.messages = [{ parts: [] }];
    render();
    visibility.foreground = false;
    thread.messages = [call("background", "a")];
    render();
    expect(merged.calls).toHaveLength(0);
    visibility.foreground = true;
    render();
    expect(merged.calls).toHaveLength(0);
  });

  it("holds a result back while the panel is closed, and applies it on reopen", () => {
    // Ask for an expansion, close the panel before the tool returns, reopen:
    // the merge had nothing to merge into, and marking the call handled anyway
    // meant the answer the user asked for was gone for good.
    act(() => useToolPanelStore.setState({ isOpen: false }));
    thread.messages = [{ parts: [] }];
    render();

    thread.messages = [call("c1", "a")];
    render();
    expect(merged.calls).toHaveLength(0);

    act(() => openGraphPanel());
    expect(merged.calls.map((p) => p.nodes[0].id)).toEqual(["a"]);
  });

  it("holds a result back while a NON-graph panel is up", () => {
    // `isOpen` alone let a result be consumed while a PDF was on screen: the
    // merge rejected the non-graph content and the call was marked handled
    // anyway, so opening the graph afterwards could never apply it — the same
    // loss the closed-panel deferral exists to prevent.
    act(() =>
      useToolPanelStore.setState({
        isOpen: true,
        content: { title: "Report", type: "document", content: "..." },
      }),
    );
    thread.messages = [{ parts: [] }];
    render();

    thread.messages = [call("c1", "a")];
    render();
    expect(merged.calls).toHaveLength(0);

    act(() => openGraphPanel());
    expect(merged.calls.map((p) => p.nodes[0].id)).toEqual(["a"]);
  });

  it("acts on a result that arrives while the thread is open", () => {
    thread.messages = [{ parts: [] }];
    render();
    expect(merged.calls).toHaveLength(0);

    thread.messages = [{ parts: [] }, call("c1", "a")];
    render();
    expect(merged.calls.map((p) => p.nodes[0].id)).toEqual(["a"]);
  });

  it("does not replay the history of a reopened conversation", () => {
    // Opening a saved chat rehydrates every turn it ever had. Without a
    // baseline the last graph in it lands on whatever the user was doing.
    thread.messages = [call("old-1", "x"), call("old-2", "y")];
    render();
    expect(merged.calls).toHaveLength(0);
  });

  it("takes its baseline on the first NON-EMPTY view, not the first render", () => {
    // A resumed thread mounts with no messages and fills them in later. A
    // baseline taken on the first effect records an empty set, and the whole
    // history then looks new.
    render();
    thread.messages = [call("old-1", "x")];
    render();
    expect(merged.calls).toHaveLength(0);

    thread.messages = [call("old-1", "x"), call("new-1", "z")];
    render();
    expect(merged.calls.map((p) => p.nodes[0].id)).toEqual(["z"]);
  });

  it("re-baselines when the thread changes, so one thread's history is not another's news", () => {
    thread.messages = [call("a-1", "x")];
    render();

    thread.threadId = "t2";
    thread.messages = [call("b-1", "y"), call("b-2", "z")];
    render();
    expect(merged.calls).toHaveLength(0);

    thread.messages = [call("b-1", "y"), call("b-2", "z"), call("b-3", "w")];
    render();
    expect(merged.calls.map((p) => p.nodes[0].id)).toEqual(["w"]);
  });

  it("acts on each result once, however often the thread re-renders", () => {
    thread.messages = [{ parts: [] }];
    render();
    thread.messages = [call("c1", "a")];
    render();
    render();
    render();
    expect(merged.calls).toHaveLength(1);
  });
});
