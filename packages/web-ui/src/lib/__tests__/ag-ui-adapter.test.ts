/**
 * Adapter shim regression tests.
 *
 * The shim is a generator-driven assistant-ui `ChatModelAdapter` wrapping
 * `@lykomi/agent`'s `AGUIRunner`. The contract under test:
 *   - Every intermediate yield carries `status: { type: "running" }`.
 *   - The FINAL yield settles the message so the bubble unsticks (the
 *     previous adapter left it `running` and it got stuck loading — PR #116):
 *     `{ type: "complete", reason: "stop" }` on success, or
 *     `{ type: "incomplete", reason: "error", error }` on RUN_ERROR so the
 *     UI shows a visible error instead of a silent empty bubble.
 *   - `content` is cumulative — every yield holds the full content array,
 *     not deltas (assistant-ui v0.12 contract).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RunnerEvent } from "@lykomi/agent";

const appStoreMock = vi.hoisted(() => ({
  agentState: {
    contextItems: [] as Array<Record<string, unknown>>,
    navigation: { contextInstructions: null as string | null },
  },
  consumedMessageIds: [] as string[],
}));

const runMock = vi.fn();
const runnerMock = vi.fn().mockImplementation(() => ({
  threadId: "thread-1",
  state: {},
  run: runMock,
}));

vi.mock("@lykomi/agent", () => ({
  agentStateStore: { getState: () => ({ setAgentState: () => {}, reset: () => {} }) },
  citationStore: { setState: () => {}, getState: () => ({ clear: () => {} }) },
  contextUsageStore: {
    getState: () => ({ record: () => {}, forget: () => {}, clear: () => {} }),
  },
  AGUIRunner: function AGUIRunnerCtor(...args: unknown[]) {
    return runnerMock(...args);
  },
  clientToolRegistry: {
    getState: () => ({
      isRegistered: (name: string) => name.startsWith("ui_"),
      executeTool: async () => "{}",
      listPageTools: () => [],
      getActiveSchemas: () => [],
    }),
  },
  streamingStatusStore: {
    setState: () => {},
    getState: () => ({
      setStreamingStatus: () => {},
      touchSignal: () => {},
      markRunStarted: () => {},
      markRunEnded: () => {},
    }),
  },
}));

vi.mock("@lykomi/agent/msal", () => ({
  tokenFetch: globalThis.fetch,
}));

vi.mock("../app-store.ts", () => ({
  useAppStore: {
    getState: () => ({
      navContext: { label: "Test" },
      markThreadActive: () => {},
      getAgentState: () => appStoreMock.agentState,
      consumeContextForMessage: (messageId: string) => {
        appStoreMock.consumedMessageIds.push(messageId);
      },
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

import { disposeChatRuns, publishChatAgentState, removeChatRun } from "../chat-runs-store.ts";
import { AGUIAdapterSDK } from "../ag-ui-adapter.ts";

function makeRunInput() {
  return {
    messages: [
      { id: "u-1", role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
    ],
    abortSignal: new AbortController().signal,
  };
}

describe("AGUIAdapterSDK", () => {
  beforeEach(() => {
    disposeChatRuns();
    runMock.mockReset();
    runnerMock.mockClear();
    appStoreMock.agentState = {
      contextItems: [],
      navigation: { contextInstructions: null },
    };
    appStoreMock.consumedMessageIds = [];
  });

  it("refuses to send from a deleted conversation even if its adapter is retained", async () => {
    const adapter = new AGUIAdapterSDK();
    removeChatRun(adapter.threadId);
    await expect(adapter.run(makeRunInput()).next()).rejects.toThrow("chat was deleted");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("restores server state and the UI baseline when a runner is recreated", async () => {
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {
      yield { type: "run-finished" };
    });
    const original = new AGUIAdapterSDK();
    for await (const result of original.run(makeRunInput())) {
      void result;
    }
    publishChatAgentState("thread-1", {
      serverOnly: "retained",
      navigation: { contextInstructions: "server update" },
    });
    const recreated = new AGUIAdapterSDK();
    for await (const result of recreated.run(makeRunInput())) {
      void result;
    }
    expect(runMock.mock.calls.at(-1)?.[0].state).toMatchObject({
      serverOnly: "retained",
      navigation: { contextInstructions: "server update" },
    });
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

  it("settles run-error as incomplete/error so the UI shows it (does not throw)", async () => {
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {
      yield { type: "turn-started" };
      yield { type: "request-sent", input: {} };
      yield { type: "run-started" };
      yield { type: "run-error", message: "boom" };
      yield { type: "streaming-status", status: { status: "idle" } };
    });

    const adapter = new AGUIAdapterSDK();
    const out: ChatModelRunResultLike[] = [];
    // On RUN_ERROR the adapter settles the message as incomplete/error
    // (NOT a silent complete/stop) so assistant-ui's <MessagePrimitive.Error>
    // renders a visible, retryable error. It must still settle via a
    // terminal yield rather than throw — an unhandled throw re-introduces
    // the stuck-running regression (message abandoned mid-run).
    for await (const r of adapter.run(makeRunInput())) {
      out.push({ status: r.status, content: r.content });
    }

    expect(out[out.length - 1].status).toEqual({
      type: "incomplete",
      reason: "error",
      error: "boom",
    });
  });

  it("forwards app context items through the native AG-UI context field", async () => {
    appStoreMock.agentState = {
      navigation: { contextInstructions: null },
      contextItems: [
        {
          type: "ref",
          refType: "block",
          refId: "entity-1:block-2",
          preview: "A selected table cell",
          targetPath: "$.blocks[?(@.id=='block-2')].rows[0].cells[1]",
          sourcePage: "/spaces/entity-1#block-block-2",
        },
      ],
    };
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {});

    const adapter = new AGUIAdapterSDK();
    for await (const _ of adapter.run(makeRunInput())) {
      // Drain the adapter.
    }

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock.mock.calls[0][0].context).toEqual([
      {
        description:
          "Selected block atom. Use targetPath as the exact edit target when the user asks to modify, rewrite, or transform selected content.",
        value: JSON.stringify(appStoreMock.agentState.contextItems[0]),
      },
    ]);
    expect(appStoreMock.consumedMessageIds).toEqual(["u-1"]);
  });

  it("forwards live process state through both AG-UI state and context with inspection semantics", async () => {
    appStoreMock.agentState = {
      navigation: { contextInstructions: null },
      contextItems: [
        {
          type: "ref",
          refType: "process",
          refId: "assessment",
          sourcePage: "/assessment",
          meta: { process: { currentStepId: "review", selectedStepId: "docs" } },
        },
      ],
    };
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {});
    const adapter = new AGUIAdapterSDK();
    for await (const _ of adapter.run(makeRunInput())) {
      /* Drain the actual adapter boundary. */
    }
    const request = runMock.mock.calls[0][0];
    expect(request.state.contextItems).toEqual(appStoreMock.agentState.contextItems);
    expect(JSON.parse(request.context[0].value)).toEqual(appStoreMock.agentState.contextItems[0]);
    expect(request.context[0].description).toContain("Selection does not execute or advance work");
  });

  it("includes completed text attachment content in outbound AG-UI messages", async () => {
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {});

    const adapter = new AGUIAdapterSDK();
    for await (const _ of adapter.run({
      messages: [
        {
          id: "u-file",
          role: "user" as const,
          content: [{ type: "text" as const, text: "what is this" }],
          attachments: [
            {
              id: "att-1",
              type: "document",
              name: "brief.docx",
              contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              status: { type: "complete" },
              content: [
                {
                  type: "text",
                  text:
                    "[Attached file: brief.docx; type: " +
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document; size: 5 B]",
                },
              ],
            },
          ],
        },
      ],
      abortSignal: new AbortController().signal,
    } as Parameters<AGUIAdapterSDK["run"]>[0])) {
      // Drain the adapter.
    }

    expect(runMock.mock.calls[0][0].messages).toEqual([
      {
        id: "u-file",
        role: "user",
        content:
          "what is this\n[Attached file: brief.docx; type: " +
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document; size: 5 B]",
      },
    ]);
  });

  it("describes typed JSON ref targets without losing the stable ref handle", async () => {
    appStoreMock.agentState = {
      navigation: { contextInstructions: null },
      contextItems: [
        {
          type: "ref",
          label: "Page Instructions · Test Page",
          refType: "entity-field",
          refId: "entity-1:instructions.agent_instructions",
          preview: "Current: old\nProposed: new",
          targetPath: "$.instructions.agent_instructions",
          target: {
            kind: "json-field",
            path: "$.instructions.agent_instructions",
            label: "Page Instructions",
            scope: "entity-field",
            containerId: "entity-1",
            containerLabel: "Test Page",
            currentValue: "old",
            proposedValue: "new",
            changeIds: ["change-1"],
          },
          sourcePage: "/spaces/entity-1",
        },
      ],
    };
    runMock.mockImplementation(async function* (): AsyncGenerator<RunnerEvent> {});

    const adapter = new AGUIAdapterSDK();
    for await (const _ of adapter.run(makeRunInput())) {
      // Drain the adapter.
    }

    expect(runMock.mock.calls[0][0].context).toEqual([
      {
        description:
          "Selected entity-field Page Instructions. Use targetPath as the exact JSON edit target when the user asks to modify, rewrite, or transform this reference.",
        value: JSON.stringify(appStoreMock.agentState.contextItems[0]),
      },
    ]);
  });
});

interface ChatModelRunResultLike {
  status: unknown;
  content: unknown;
}
