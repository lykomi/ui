import { act, useEffect } from "react";
import { MemoryRouter } from "react-router";
import { createRoot } from "react-dom/client";
import { useAui, useAuiState, type AssistantClient } from "@assistant-ui/react";
import { expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
import { AGUIRuntimeProvider, useAGUIAdapter } from "../components/ag-ui-runtime-provider.tsx";
import { disposeChatRuns } from "../lib/chat-runs-store.ts";
import { useWorkbenchCollapsed } from "../workbench/layout-state.tsx";

it("retains the expanded layout across a new runtime and a resumed conversation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const mounted = vi.fn();
  let finishResponse: (response: Response) => void;
  let request: { threadId: string; runId: string };
  const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    request = JSON.parse(String(init?.body));
    return new Promise<Response>((resolve) => {
      finishResponse = resolve;
    });
  });
  vi.stubGlobal("fetch", fetchFn);
  let client: AssistantClient;
  let firstThread: string;
  function Probe() {
    const [collapsed, setCollapsed] = useWorkbenchCollapsed(true);
    const { resetThread, adapter } = useAGUIAdapter();
    firstThread ??= adapter.threadId;
    client = useAui();
    const draft = useAuiState((state) => state.composer.text);
    useEffect(() => {
      mounted();
    }, []);
    return (
      <>
        <input aria-label="Content draft" defaultValue="unsaved page edit" />
        <output>{draft}</output>
        <button
          onClick={() => {
            setCollapsed(false);
            resetThread();
          }}
        >
          {collapsed ? "collapsed" : "expanded"}
        </button>
      </>
    );
  }
  const render = (threadId?: string) =>
    act(async () => {
      root.render(
        <MemoryRouter>
          <AGUIRuntimeProvider threadId={threadId} fetchFn={fetchFn}>
            <Probe />
          </AGUIRuntimeProvider>
        </MemoryRouter>,
      );
    });
  try {
    await render();
    expect(host.textContent).toBe("collapsed");
    const pageInput = host.querySelector("input")!;
    await act(async () => client.composer().setText("unfinished question"));
    expect(host.querySelector("output")?.textContent).toBe("unfinished question");
    await act(async () => host.querySelector("button")!.click());
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe("expanded");
    expect(host.querySelector("input")).toBe(pageInput);
    expect(pageInput.value).toBe("unsaved page edit");
    expect(host.querySelector("output")?.textContent).toBe("");
    await render(firstThread!);
    expect(host.querySelector("output")?.textContent).toBe("unfinished question");
    await render("resumed-thread");
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(host.textContent).toBe("expanded");
    await render(firstThread!);
    const backgroundClient = client!;
    await act(async () => {
      backgroundClient.composer().send();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await render("resumed-thread");
    expect(client!.thread().getState().messages).toHaveLength(0);
    await act(async () => {
      const { threadId, runId } = request!;
      finishResponse!(
        new Response(
          [
            { type: "RUN_STARTED", threadId, runId },
            { type: "TEXT_MESSAGE_START", messageId: "reply", role: "assistant" },
            { type: "TEXT_MESSAGE_CONTENT", messageId: "reply", delta: "Background answer" },
            { type: "TEXT_MESSAGE_END", messageId: "reply" },
            { type: "RUN_FINISHED", threadId, runId },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
          {
            headers: { "content-type": "text/event-stream" },
          },
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(client!.thread().getState().messages).toHaveLength(0);
    await render(firstThread!);
    expect(client!.thread().getState().isRunning).toBe(false);
    expect(JSON.stringify(client!.thread().getState().messages)).toContain("Background answer");
    expect(host.querySelector("input")).toBe(pageInput);
    expect(mounted).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    disposeChatRuns();
    vi.unstubAllGlobals();
  }
});
