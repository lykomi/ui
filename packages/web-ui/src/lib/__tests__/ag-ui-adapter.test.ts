/**
 * Adapter shim regression tests.
 *
 * The shim is a generator-driven assistant-ui `ChatModelAdapter` wrapping
 * `@lastspace/agent`'s `AGUIRunner`. The contract under test:
 *   - Every intermediate yield carries `status: { type: "running" }`.
 *   - The FINAL yield carries `status: { type: "complete", reason: "stop" }`
 *     even after a multi-turn client-tool follow-up — the previous adapter
 *     left this status as `running` and the message bubble got stuck in
 *     the loading state. See PR #116 review.
 *   - `content` is cumulative — every yield holds the full content array,
 *     not deltas (assistant-ui v0.12 contract).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RunnerEvent } from "@lastspace/agent";

const runMock = vi.fn();
const runnerMock = vi.fn().mockImplementation(() => ({
  threadId: "thread-1",
  state: {},
  run: runMock,
}));

vi.mock("@lastspace/agent", () => ({
  AGUIRunner: function AGUIRunnerCtor(...args: unknown[]) {
    return runnerMock(...args);
  },
  clientToolRegistry: {
    getState: () => ({
      isRegistered: (name: string) => name.startsWith("ui_"),
      executeTool: async () => "{}",
      getActiveSchemas: () => [],
    }),
  },
  streamingStatusStore: {
    getState: () => ({ setStreamingStatus: () => {} }),
  },
}));

vi.mock("@lastspace/agent/msal", () => ({
  tokenFetch: globalThis.fetch,
}));

vi.mock("../app-store.ts", () => ({
  useAppStore: {
    getState: () => ({
      markThreadActive: () => {},
      getAgentState: () => ({ contextItems: [] }),
      consumeContextForMessage: () => {},
    }),
  },
}));

vi.mock("../dev-store.ts", () => ({
  useDevStore: {
    getState: () => ({
      captureRequest: () => {},
      addToolCall: () => {},
      updateToolCall: () => {},
    }),
  },
}));

import { AGUIAdapterSDK } from "../ag-ui-adapter.ts";

function makeRunInput() {
  return {
    messages: [{ id: "u-1", role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }],
    abortSignal: undefined as AbortSignal | undefined,
  };
}

describe("AGUIAdapterSDK", () => {
  beforeEach(() => {
    runMock.mockReset();
    runnerMock.mockClear();
  });

  it("yields a terminal complete after a text-only run", async () => {
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {
      yield { type: "turn-started" };
      yield { type: "request-sent", input: {} };
      yield { type: "run-started" };
      yield { type: "text-delta", delta: "hello" };
      yield { type: "text-message-end" };
      yield { type: "run-finished" };
      yield { type: "streaming-status", status: { status: "idle" } };
    });

    const adapter = new AGUIAdapterSDK();
    const out: Array<{ status: unknown; content: unknown }> = [];
    for await (const r of adapter.run(makeRunInput())) {
      out.push({ status: r.status, content: r.content });
    }

    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 1].status).toEqual({ type: "complete", reason: "stop" });
  });

  it("yields a terminal complete after a multi-turn client-tool follow-up", async () => {
    // Reproduces the regression from PR #116 review: the previous shim
    // kept yielding `status: running` after the final run-finished because
    // the `needsFollowUp` check stayed true once a client tool resolved.
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {
      // Turn 1 — agent calls client-side ui_navigate, runner executes locally.
      yield { type: "turn-started" };
      yield { type: "request-sent", input: {} };
      yield { type: "run-started" };
      yield { type: "tool-call-start", id: "tc-1", name: "ui_navigate", isClientSide: true };
      yield { type: "tool-call-args", id: "tc-1", delta: '{"path":"/foo"}' };
      yield {
        type: "tool-call-end",
        id: "tc-1",
        args: '{"path":"/foo"}',
        result: { status: "success" },
      };
      yield { type: "run-finished" };
      // Turn 2 — agent acks with text after follow-up.
      yield { type: "turn-started" };
      yield { type: "request-sent", input: {} };
      yield { type: "run-started" };
      yield { type: "text-delta", delta: "Done" };
      yield { type: "text-message-end" };
      yield { type: "run-finished" };
      yield { type: "streaming-status", status: { status: "idle" } };
    });

    const adapter = new AGUIAdapterSDK();
    const out: ChatModelRunResultLike[] = [];
    for await (const r of adapter.run(makeRunInput())) {
      out.push({ status: r.status, content: r.content });
    }

    expect(out.length).toBeGreaterThan(0);

    // Every intermediate yield is "running".
    for (const r of out.slice(0, -1)) {
      expect(r.status).toEqual({ type: "running" });
    }

    // The FINAL yield is complete (the regression: previously stuck on running).
    expect(out[out.length - 1].status).toEqual({ type: "complete", reason: "stop" });

    // Content is cumulative — the final yield carries both the resolved
    // tool-call and the text from turn 2.
    const finalContent = out[out.length - 1].content as Array<{
      type: string;
      toolCallId?: string;
      text?: string;
    }>;
    expect(finalContent.find((p) => p.type === "tool-call")?.toolCallId).toBe("tc-1");
    expect(finalContent.find((p) => p.type === "text")?.text).toBe("Done");
  });

  it("yields a terminal complete on run-error (does not throw)", async () => {
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {
      yield { type: "turn-started" };
      yield { type: "request-sent", input: {} };
      yield { type: "run-started" };
      yield { type: "run-error", message: "boom" };
      yield { type: "streaming-status", status: { status: "idle" } };
    });

    const adapter = new AGUIAdapterSDK();
    const out: ChatModelRunResultLike[] = [];
    // The shim swallows run errors and emits a terminal complete so the
    // bubble unsticks. Throwing here would re-introduce the stuck-running
    // regression because assistant-ui treats unhandled throws as the
    // message being abandoned mid-run.
    for await (const r of adapter.run(makeRunInput())) {
      out.push({ status: r.status, content: r.content });
    }

    expect(out[out.length - 1].status).toEqual({ type: "complete", reason: "stop" });
  });
});

interface ChatModelRunResultLike {
  status: unknown;
  content: unknown;
}
