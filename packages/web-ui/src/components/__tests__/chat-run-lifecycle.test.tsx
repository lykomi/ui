import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { useAui, useAuiState, type ThreadHistoryAdapter } from "@assistant-ui/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AGUIRuntimeProvider } from "../ag-ui-runtime-provider.tsx";
import {
  useChatRuns,
  warnBeforeChatUnload,
  selectChatRun,
  waitForForegroundChat,
  beginChatRun,
  updateChatRun,
} from "../../lib/chat-runs-store.ts";
import { streamingStatusStore } from "@iloveagents/foundry-agent";

vi.mock("../client-tool-executor.tsx", () => ({ ClientToolExecutor: () => null }));
vi.mock("../show-document-tool-ui.tsx", () => ({ ShowDocumentToolUI: () => null }));
let aui: ReturnType<typeof useAui>;
function Probe() {
  aui = useAui();
  const messages = useAuiState((s) => s.thread.messages);
  return (
    <div>
      {messages.flatMap((m) => m.content.map((p) => (p.type === "text" ? p.text : ""))).join("|")}
    </div>
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useChatRuns.setState({ foregroundId: null, runs: {} });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains two independent streams across chat switches, persists both, and resumes without loading twice", async () => {
  const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();
  const signals = new Map<string, AbortSignal>();
  const emit = (id: string, event: Record<string, unknown>) =>
    streams.get(id)!.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  const fetchFn: typeof fetch = vi.fn(async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    signals.set(body.threadId, init!.signal as AbortSignal);
    return new Response(
      new ReadableStream({
        start(controller) {
          streams.set(body.threadId, controller);
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  vi.stubGlobal("fetch", fetchFn);
  const writes: Record<string, unknown[]> = {};
  const loads = vi.fn();
  const factory = ({ aguiThreadId }: { aguiThreadId: string }): ThreadHistoryAdapter => ({
    load: async () => {
      loads(aguiThreadId);
      return { messages: [] };
    },
    append: async (item) => {
      (writes[aguiThreadId] ??= []).push(item);
    },
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = async (id: string) => {
    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter>
            <AGUIRuntimeProvider
              threadId={id}
              urlMatch={id}
              fetchFn={fetchFn}
              historyAdapterFactory={factory}
            >
              <Probe />
            </AGUIRuntimeProvider>
          </MemoryRouter>
        </StrictMode>,
      );
    });
  };
  const send = async (text: string) => {
    await act(async () => {
      aui.composer().setText(text);
      aui.composer().send();
    });
  };
  try {
    await render("a");
    await send("First question");
    await act(async () => {
      emit("a", { type: "RUN_STARTED", threadId: "a", runId: "ra" });
      emit("a", { type: "TEXT_MESSAGE_START", messageId: "ma", role: "assistant" });
    });
    await render("b");
    await send("Second question");
    expect(signals.get("a")?.aborted).toBe(false);
    await act(async () => {
      emit("b", { type: "RUN_STARTED", threadId: "b", runId: "rb" });
      emit("b", { type: "TEXT_MESSAGE_START", messageId: "mb", role: "assistant" });
      emit("b", { type: "TEXT_MESSAGE_CONTENT", messageId: "mb", delta: "Answer B" });
    });
    const warning = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(warning);
    expect(warning.defaultPrevented).toBe(true);
    await act(async () => {
      emit("a", { type: "TEXT_MESSAGE_CONTENT", messageId: "ma", delta: "Answer A" });
      emit("a", { type: "TEXT_MESSAGE_END", messageId: "ma" });
      emit("a", { type: "RUN_FINISHED", threadId: "a", runId: "ra" });
      streams.get("a")!.close();
    });
    expect(container.textContent).toContain("Answer B");
    expect(container.textContent).not.toContain("Answer A");
    expect(useChatRuns.getState().runs.a?.status).toBe("completed");
    expect(useChatRuns.getState().runs.b?.status).toBe("running");
    expect(streamingStatusStore.getState().runStartedAt).not.toBeNull();
    await render("a");
    expect(container.textContent).toContain("Answer A");
    expect(loads.mock.calls.filter(([id]) => id === "a")).toHaveLength(1);
    expect(JSON.stringify(writes.a)).toContain("Answer A");
    await act(async () => {
      useChatRuns.getState().runs.b!.stop();
      streams.get("b")!.close();
    });
    expect(useChatRuns.getState().runs.b?.status).toBe("cancelled");
    const idleWarning = new Event("beforeunload", { cancelable: true });
    warnBeforeChatUnload(idleWarning as BeforeUnloadEvent);
    expect(idleWarning.defaultPrevented).toBe(false);
  } finally {
    await act(async () => {
      root.unmount();
    });
  }
});

describe("background browser actions", () => {
  it("waits for its own chat and can be stopped while waiting", async () => {
    beginChatRun({ threadId: "a", title: "A", stop: vi.fn() });
    selectChatRun("b");
    const controller = new AbortController();
    let resumed = false;
    const waiting = waitForForegroundChat("a", controller.signal).then(() => {
      resumed = true;
    });
    expect(useChatRuns.getState().runs.a?.status).toBe("waiting");
    await Promise.resolve();
    expect(resumed).toBe(false);
    selectChatRun("a");
    await waiting;
    expect(resumed).toBe(true);
    selectChatRun("b");
    const stopped = waitForForegroundChat("a", controller.signal);
    controller.abort();
    await expect(stopped).rejects.toMatchObject({ name: "AbortError" });
    updateChatRun("a", "cancelled");
  });
});
