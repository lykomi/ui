/**
 * A chat turn that ends on a client tool finishes in a hidden tab.
 *
 * AG-UI ends the server run on a client tool call; the browser executes the
 * tool and posts a continuation. A background tab gets no animation frames,
 * so anything on that path that waited for one — a render, an animation, a
 * frame-batched flush — would stop the turn until somebody looked at it. This
 * pins that nothing does. (A tab the browser FREEZES runs nothing at all;
 * that case is the server's to avoid by answering cosmetic UI tools itself —
 * see the runner's server-answered test.)
 */
import { act } from "react";
import { MemoryRouter } from "react-router";
import { createRoot } from "react-dom/client";
import { useAui, useAuiState } from "@assistant-ui/react";
import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
import { AGUIRuntimeProvider } from "../components/ag-ui-runtime-provider.tsx";
import { disposeChatRuns } from "../lib/chat-runs-store.ts";
import "../lib/client-tools.ts";

function sse(events: Array<Record<string, unknown>>): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  disposeChatRuns();
  vi.unstubAllGlobals();
});

it("posts the client-tool continuation and finishes the turn while the tab is hidden", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // A background tab: hidden, and not one animation frame, ever.
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);

  const bodies: Array<Record<string, unknown>> = [];
  const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    bodies.push(body);
    const runId = String(body.runId ?? "run");
    const threadId = String(body.threadId ?? "thread");
    if (bodies.length === 1) {
      return sse([
        { type: "RUN_STARTED", threadId, runId },
        {
          type: "TOOL_CALL_START",
          toolCallId: "call-panel",
          toolCallName: "ui_open_panel",
          parentMessageId: "m1",
        },
        { type: "TOOL_CALL_ARGS", toolCallId: "call-panel", delta: '{"title":"Suppliers"}' },
        { type: "TOOL_CALL_END", toolCallId: "call-panel" },
        { type: "RUN_FINISHED", threadId, runId },
      ]);
    }
    return sse([
      { type: "RUN_STARTED", threadId, runId },
      { type: "TEXT_MESSAGE_START", messageId: "m2", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "m2", delta: "Built the app." },
      { type: "TEXT_MESSAGE_END", messageId: "m2" },
      { type: "RUN_FINISHED", threadId, runId },
    ]);
  });
  vi.stubGlobal("fetch", fetchFn);

  let send: (text: string) => void = () => {};
  function Probe() {
    const aui = useAui();
    send = (text) => {
      aui.composer.setText(text);
      aui.composer.send();
    };
    const running = useAuiState((state) => state.thread.isRunning);
    const last = useAuiState((state) => {
      const messages = state.thread.messages;
      const message = messages[messages.length - 1];
      if (!message || message.role !== "assistant") return "";
      return message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");
    });
    return <output data-running={String(running)}>{last}</output>;
  }

  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AGUIRuntimeProvider threadId="hidden-tab" fetchFn={fetchFn}>
            <Probe />
          </AGUIRuntimeProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => send("build an app for supplier research"));
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && host.querySelector("output")?.dataset.running !== "false") {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
    }

    expect(bodies).toHaveLength(2);
    const replayed = (bodies[1]!.messages as Array<Record<string, unknown>>) ?? [];
    const answer = replayed.find((message) => message.role === "tool");
    expect(answer?.toolCallId).toBe("call-panel");
    expect(host.textContent).toContain("Built the app.");
    expect(host.querySelector("output")?.dataset.running).toBe("false");
  } finally {
    await act(async () => root.unmount());
    visibility.mockRestore();
    hidden.mockRestore();
  }
});
