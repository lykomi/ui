import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSubscriber } from "@ag-ui/client";

// Scripted event playback for the mocked HttpAgent. Each test sets `script`
// to an array of (subscriber) => Promise<void> functions. The mock's
// runAgent fires them in order, synchronously yielding the loop between
// each one so the runner's queue can drain.

type ScriptedRun = (subscriber: AgentSubscriber, agent: { messages: unknown[] }) => Promise<void>;

let nextScript: ScriptedRun[] = [];
let runCount = 0;
let lastMessages: unknown[] = [];

vi.mock("@ag-ui/client", () => {
  class MockHttpAgent {
    threadId: string;
    state: Record<string, unknown> = {};
    messages: unknown[] = [];

    constructor(opts: { url?: string; threadId?: string }) {
      this.threadId = opts.threadId ?? "thread-1";
    }

    setMessages(messages: unknown[]) {
      this.messages = [...messages];
      lastMessages = this.messages;
    }
    setState(state: Record<string, unknown>) {
      this.state = state;
    }
    addMessage(message: unknown) {
      this.messages.push(message);
      lastMessages = this.messages;
    }

    async runAgent(_params: unknown, subscriber: AgentSubscriber): Promise<void> {
      const turnIdx = runCount;
      runCount++;
      const script = nextScript[turnIdx];
      if (script) await script(subscriber, this);
    }

    abortRun() {
      // no-op for tests
    }
  }
  return { HttpAgent: MockHttpAgent };
});

import { AGUIRunner } from "../client/agui-runner.ts";
import { clientToolRegistry } from "../tools/registry.ts";
import type { RunnerEvent } from "../client/runner-events.ts";

function makeRegistry(client: {
  isRegistered: (name: string) => boolean;
  executeTool?: (name: string, args: string) => Promise<string>;
}) {
  return {
    isRegistered: client.isRegistered,
    executeTool: client.executeTool ?? (async () => JSON.stringify({})),
    getActiveSchemas: () => [],
  };
}

async function collect(
  runner: AGUIRunner,
  registry: ReturnType<typeof makeRegistry>,
): Promise<RunnerEvent[]> {
  const out: RunnerEvent[] = [];
  for await (const evt of runner.run({ messages: [], registry })) {
    out.push(evt);
  }
  return out;
}

async function collectWithMessages(
  runner: AGUIRunner,
  messages: Parameters<AGUIRunner["run"]>[0]["messages"],
  registry: ReturnType<typeof makeRegistry>,
): Promise<RunnerEvent[]> {
  const out: RunnerEvent[] = [];
  for await (const evt of runner.run({ messages, registry })) {
    out.push(evt);
  }
  return out;
}

describe("AGUIRunner", () => {
  beforeEach(() => {
    nextScript = [];
    runCount = 0;
    lastMessages = [];
    clientToolRegistry.setState({ globalTools: new Map(), pageTools: new Map() });
  });

  it("emits the canonical event sequence for a text-only run", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onTextMessageStartEvent?.({ event: { type: "TEXT_MESSAGE_START" } } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "Hello" } as never,
        } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: " world" } as never,
        } as never);
        await s.onTextMessageEndEvent?.({ event: { type: "TEXT_MESSAGE_END" } } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const types = events.map((e) => e.type);
    expect(types).toContain("turn-started");
    expect(types).toContain("request-sent");
    expect(types).toContain("run-started");
    expect(types).toContain("text-delta");
    expect(types).toContain("text-message-end");
    expect(types).toContain("run-finished");

    const deltas = events.filter(
      (e): e is Extract<RunnerEvent, { type: "text-delta" }> => e.type === "text-delta",
    );
    expect(deltas.map((d) => d.delta).join("")).toBe("Hello world");
  });

  it("emits tool-call events with isClientSide flag", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onToolCallStartEvent?.({
          event: {
            type: "TOOL_CALL_START",
            toolCallId: "tc-1",
            toolCallName: "server_tool",
          } as never,
        } as never);
        await s.onToolCallArgsEvent?.({
          event: { type: "TOOL_CALL_ARGS", toolCallId: "tc-1", delta: '{"q":"x"}' } as never,
        } as never);
        await s.onToolCallEndEvent?.({
          event: { type: "TOOL_CALL_END", toolCallId: "tc-1" } as never,
        } as never);
        await s.onToolCallResultEvent?.({
          event: {
            type: "TOOL_CALL_RESULT",
            toolCallId: "tc-1",
            content: '{"ok":true}',
          } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const start = events.find(
      (e): e is Extract<RunnerEvent, { type: "tool-call-start" }> => e.type === "tool-call-start",
    );
    expect(start).toBeDefined();
    expect(start!.isClientSide).toBe(false);
    expect(start!.name).toBe("server_tool");

    const result = events.find(
      (e): e is Extract<RunnerEvent, { type: "tool-call-result" }> => e.type === "tool-call-result",
    );
    expect(result).toBeDefined();
    expect(result!.result).toEqual({ ok: true });
    expect(result!.isError).toBe(false);
  });

  it("intercepts client-side tools and re-issues the run with the result", async () => {
    const executeTool = vi.fn().mockResolvedValue('{"navigated":true}');

    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onToolCallStartEvent?.({
          event: {
            type: "TOOL_CALL_START",
            toolCallId: "tc-1",
            toolCallName: "ui_navigate",
          } as never,
        } as never);
        await s.onToolCallArgsEvent?.({
          event: {
            type: "TOOL_CALL_ARGS",
            toolCallId: "tc-1",
            delta: '{"path":"/foo"}',
          } as never,
        } as never);
        await s.onToolCallEndEvent?.({
          event: { type: "TOOL_CALL_END", toolCallId: "tc-1" } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
      async (s) => {
        // Second turn after follow-up: agent acknowledges with text + finishes.
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onTextMessageStartEvent?.({ event: { type: "TEXT_MESSAGE_START" } } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "Done" } as never,
        } as never);
        await s.onTextMessageEndEvent?.({ event: { type: "TEXT_MESSAGE_END" } } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(
      runner,
      makeRegistry({
        isRegistered: (name) => name === "ui_navigate",
        executeTool,
      }),
    );

    expect(executeTool).toHaveBeenCalledWith("ui_navigate", '{"path":"/foo"}');
    expect(runCount).toBe(2); // Initial + follow-up

    // Second turn was issued with the same toolCallId in the assistant message
    const lastAssistantMsg = lastMessages.find(
      (m): m is { role: string; toolCalls?: Array<{ id: string }> } =>
        typeof m === "object" && m !== null && (m as { role?: string }).role === "assistant",
    );
    expect(lastAssistantMsg?.toolCalls?.[0]?.id).toBe("tc-1");

    // tool-call-start should have isClientSide=true
    const start = events.find(
      (e): e is Extract<RunnerEvent, { type: "tool-call-start" }> => e.type === "tool-call-start",
    );
    expect(start!.isClientSide).toBe(true);
  });

  it("preserves pre-tool assistant text in the follow-up replay", async () => {
    // Regression: if the model emits text before the tool call in the
    // same turn ("Looking up..." then ui_navigate), the follow-up
    // assistant message must include that text. Otherwise the next-turn
    // context drifts (no server-side thread state — full history rides
    // each request).
    const executeTool = vi.fn().mockResolvedValue('{"ok":true}');

    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onTextMessageStartEvent?.({ event: { type: "TEXT_MESSAGE_START" } } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "Navigating..." } as never,
        } as never);
        await s.onTextMessageEndEvent?.({ event: { type: "TEXT_MESSAGE_END" } } as never);
        await s.onToolCallStartEvent?.({
          event: {
            type: "TOOL_CALL_START",
            toolCallId: "tc-pre",
            toolCallName: "ui_navigate",
          } as never,
        } as never);
        await s.onToolCallArgsEvent?.({
          event: {
            type: "TOOL_CALL_ARGS",
            toolCallId: "tc-pre",
            delta: '{"path":"/x"}',
          } as never,
        } as never);
        await s.onToolCallEndEvent?.({
          event: { type: "TOOL_CALL_END", toolCallId: "tc-pre" } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    await collect(
      runner,
      makeRegistry({
        isRegistered: (name) => name === "ui_navigate",
        executeTool,
      }),
    );

    expect(runCount).toBe(2);
    const lastAssistant = lastMessages.find(
      (m): m is { role: string; content: string; toolCalls?: Array<{ id: string }> } =>
        typeof m === "object" && m !== null && (m as { role?: string }).role === "assistant",
    );
    expect(lastAssistant?.content).toBe("Navigating...");
  });

  it("preserves hidden protocol messages from AG-UI snapshots across visible UI turns", async () => {
    const registry = makeRegistry({ isRegistered: () => false });
    const runner = new AGUIRunner();

    nextScript = [
      async (s, agent) => {
        agent.messages = [
          {
            id: "spaces-global-guidance:abc",
            role: "system",
            content: "Tenant guidance",
          },
          { id: "u-1", role: "user", content: "What is your name?" },
          { id: "a-1", role: "assistant", content: "Magic Luna." },
        ];
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    await collectWithMessages(
      runner,
      [{ id: "u-1", role: "user", content: "What is your name?" }],
      registry,
    );

    nextScript = [
      async (s) => {
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const events = await collectWithMessages(
      runner,
      [
        { id: "u-1", role: "user", content: "What is your name?" },
        { id: "a-1", role: "assistant", content: "Magic Luna." },
        { id: "u-2", role: "user", content: "Say your name again." },
      ],
      registry,
    );

    const request = events.find(
      (event): event is Extract<RunnerEvent, { type: "request-sent" }> =>
        event.type === "request-sent",
    );
    expect(request?.input.messages).toEqual([
      {
        id: "spaces-global-guidance:abc",
        role: "system",
        content: "Tenant guidance",
      },
      { id: "u-1", role: "user", content: "What is your name?" },
      { id: "a-1", role: "assistant", content: "Magic Luna." },
      { id: "u-2", role: "user", content: "Say your name again." },
    ]);
  });

  it("yields turn-started exactly once per run iteration", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const turnStarts = events.filter((e) => e.type === "turn-started");
    expect(turnStarts.length).toBe(1);
  });

  it("emits request-sent before any subscriber events", async () => {
    nextScript = [
      async (s) => {
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const requestIdx = events.findIndex((e) => e.type === "request-sent");
    const finishedIdx = events.findIndex((e) => e.type === "run-finished");
    expect(requestIdx).toBeGreaterThanOrEqual(0);
    expect(requestIdx).toBeLessThan(finishedIdx);
  });

  it("translates RUN_ERROR into run-error with the message", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onRunErrorEvent?.({
          event: { type: "RUN_ERROR", message: "boom" } as never,
        } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const err = events.find(
      (e): e is Extract<RunnerEvent, { type: "run-error" }> => e.type === "run-error",
    );
    expect(err).toBeDefined();
    expect(err!.message).toBe("boom");
  });
});

// --- Stream-integrity + liveness (the silent-wedge fixes) ------------------
//
// A proxy idle-timeout or dropped connection closes the SSE stream WITHOUT a
// terminal RUN_FINISHED / RUN_ERROR. The AG-UI client resolves runAgent()
// normally in that case, so the runner must detect the protocol violation
// and surface an explicit run-error — a truncated answer must never render
// as a completed one (a wedge observed with real key-users in production).
describe("stream integrity", () => {
  beforeEach(() => {
    nextScript = [];
    runCount = 0;
  });

  it("synthesizes run-error when the stream closes without a terminal event", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "partial answer…" } as never,
        } as never);
        // stream dies here: no RUN_FINISHED, runAgent resolves cleanly
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const err = events.find(
      (e): e is Extract<RunnerEvent, { type: "run-error" }> => e.type === "run-error",
    );
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/connection to the agent was lost/i);
    expect(events.some((e) => e.type === "run-finished")).toBe(false);
    // terminal idle status still emitted so consumers reset their spinners
    const statuses = events.filter(
      (e): e is Extract<RunnerEvent, { type: "streaming-status" }> =>
        e.type === "streaming-status",
    );
    expect(statuses[statuses.length - 1]?.status.status).toBe("idle");
  });

  it("does NOT synthesize an error after a proper RUN_FINISHED", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    expect(events.some((e) => e.type === "run-finished")).toBe(true);
    expect(events.some((e) => e.type === "run-error")).toBe(false);
  });

  it("normalizes transport rejections onto run-error instead of throwing", async () => {
    nextScript = [
      async () => {
        throw new Error("fetch failed: network reset");
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const err = events.find(
      (e): e is Extract<RunnerEvent, { type: "run-error" }> => e.type === "run-error",
    );
    expect(err).toBeDefined();
    expect(err!.message).toContain("fetch failed");
  });

  it("forwards server heartbeat CUSTOM events as heartbeat runner events", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onCustomEvent?.({
          event: { type: "CUSTOM", name: "heartbeat", value: { elapsedMs: 1234 } } as never,
        } as never);
        await s.onCustomEvent?.({
          event: { type: "CUSTOM", name: "something-else", value: {} } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const beats = events.filter(
      (e): e is Extract<RunnerEvent, { type: "heartbeat" }> => e.type === "heartbeat",
    );
    expect(beats).toHaveLength(1);
    expect(beats[0].elapsedMs).toBe(1234);
  });

  it("does not duplicate a tool call the AG-UI client already recorded", async () => {
    // The real AbstractAgent folds the streamed assistant message — tool calls
    // included — into `agent.messages` while the run is applied. The runner
    // used to append its own copy unconditionally, so the follow-up carried
    // the SAME toolCallId twice against a single tool result: the model saw an
    // unanswered tool call, re-issued the tool, and then reported that it
    // "didn't complete" even though it had succeeded.
    nextScript = [
      async (s, agent) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onToolCallStartEvent?.({
          event: {
            type: "TOOL_CALL_START",
            toolCallId: "tc-dup",
            toolCallName: "ui_get_context",
          } as never,
        } as never);
        await s.onToolCallArgsEvent?.({
          event: { type: "TOOL_CALL_ARGS", toolCallId: "tc-dup", delta: "{}" } as never,
        } as never);
        await s.onToolCallEndEvent?.({
          event: { type: "TOOL_CALL_END", toolCallId: "tc-dup" } as never,
        } as never);
        // What defaultApplyEvents does on the real client:
        agent.messages.push({
          id: "srv-1",
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "tc-dup", type: "function", function: { name: "ui_get_context", arguments: "{}" } },
          ],
        });
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "Here is your context." } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner();
    await collect(
      runner,
      makeRegistry({
        isRegistered: (name) => name === "ui_get_context",
        executeTool: async () => '{"status":"success"}',
      }),
    );

    const toolCallIds = lastMessages.flatMap((m) => {
      const msg = m as { role?: string; toolCalls?: Array<{ id: string }> };
      return msg.role === "assistant" && msg.toolCalls ? msg.toolCalls.map((t) => t.id) : [];
    });
    expect(toolCallIds.filter((id) => id === "tc-dup")).toHaveLength(1);

    // ...and exactly one matching result, so the call is answered.
    const toolResults = lastMessages.filter((m) => {
      const msg = m as { role?: string; toolCallId?: string };
      return msg.role === "tool" && msg.toolCallId === "tc-dup";
    });
    expect(toolResults).toHaveLength(1);
  });

  it("emits stalled status during a quiet stretch and recovers on the next event", async () => {
    nextScript = [
      async (s) => {
        await s.onRunStartedEvent?.({ event: { type: "RUN_STARTED" } } as never);
        await new Promise((r) => setTimeout(r, 220)); // quiet > stallAfterMs
        await s.onTextMessageContentEvent?.({
          event: { type: "TEXT_MESSAGE_CONTENT", delta: "back alive" } as never,
        } as never);
        await s.onRunFinishedEvent?.({ event: { type: "RUN_FINISHED" } } as never);
      },
    ];

    const runner = new AGUIRunner({ stallAfterMs: 60 });
    const events = await collect(runner, makeRegistry({ isRegistered: () => false }));

    const statuses = events
      .filter(
        (e): e is Extract<RunnerEvent, { type: "streaming-status" }> =>
          e.type === "streaming-status",
      )
      .map((e) => e.status.status);
    const stalledIdx = statuses.indexOf("stalled");
    expect(stalledIdx).toBeGreaterThan(-1);
    // recovery: a non-stalled status follows before the run ends
    expect(statuses.slice(stalledIdx + 1)).toContain("thinking");
    expect(events.some((e) => e.type === "run-error")).toBe(false);
  });
});
