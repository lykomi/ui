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
