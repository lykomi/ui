/**
 * AG-UI Runner — protocol engine for `@iloveagents/foundry-agent`.
 *
 * Drives the AG-UI SDK's `HttpAgent.runAgent()` with an `AgentSubscriber`,
 * fans the subscriber callbacks out as a normalized `RunnerEvent` stream,
 * and re-issues the run with appended assistant + tool messages whenever a
 * client-side tool produces a result.
 *
 * Framework-agnostic — no React, no `@assistant-ui/*`. The assistant-ui shim
 * in `@iloveagents/foundry-web-ui` (and future Outlook / Teams / native shells)
 * translate `RunnerEvent`s into their own model.
 *
 * @see https://docs.ag-ui.com/sdk/js/client/http-agent
 * @see https://docs.ag-ui.com/sdk/js/client/subscriber
 */

import { HttpAgent, type AgentSubscriber } from "@ag-ui/client";
import type { Context, Message, Tool } from "@ag-ui/core";
import type { ToolRegistry } from "../tools/registry.ts";
import type { RunnerEvent } from "./runner-events.ts";

interface ToolCallState {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  isError?: boolean;
  followedUp?: boolean;
}

export interface AGUIRunnerOptions {
  url?: string;
  threadId?: string;
  /** Optional override for the underlying fetch — useful for auth-attached fetch. */
  fetchFn?: typeof fetch;
}

export interface AGUIRunInput {
  /** AG-UI messages — caller is responsible for runtime-specific message conversion. */
  messages: Message[];
  /** Optional state snapshot (e.g. context items) sent to the agent. */
  state?: Record<string, unknown>;
  /** Tool registry consulted for client-side tool dispatch + schemas. */
  registry: ToolRegistry;
  /** Aborts the run — generator returns cleanly when the signal fires. */
  abortSignal?: AbortSignal;
  /** Optional context payload forwarded with every turn (default: empty array). */
  context?: Context[];
}

/**
 * Bridges callback-driven `AgentSubscriber` events into an async-iterable
 * queue the runner's generator drains. Single-producer / single-consumer.
 */
class EventQueue<T> {
  private buffer: T[] = [];
  private resolve: (() => void) | null = null;
  private ended = false;
  private error: unknown = null;

  push(value: T): void {
    this.buffer.push(value);
    this.flush();
  }

  end(error?: unknown): void {
    this.ended = true;
    if (error !== undefined) this.error = error;
    this.flush();
  }

  private flush(): void {
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r();
    }
  }

  async *drain(): AsyncGenerator<T> {
    for (;;) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift()!;
        continue;
      }
      if (this.ended) {
        if (this.error) throw this.error;
        return;
      }
      await new Promise<void>((r) => {
        this.resolve = r;
      });
    }
  }
}

/**
 * AG-UI Runner.
 *
 * Reusable across runs — instantiate once, call `run()` per turn batch.
 * Maintains `threadId` and the `HttpAgent` state snapshot across calls.
 */
export class AGUIRunner {
  private readonly httpAgent: HttpAgent;

  constructor(options: AGUIRunnerOptions = {}) {
    this.httpAgent = new HttpAgent({
      url: options.url ?? "/api/agent",
      threadId: options.threadId ?? crypto.randomUUID(),
      ...(options.fetchFn ? { fetch: options.fetchFn } : {}),
    });
  }

  get threadId(): string {
    return this.httpAgent.threadId;
  }

  get state(): unknown {
    return this.httpAgent.state;
  }

  /**
   * Run a single AG-UI exchange (with multi-turn re-issue when client-side
   * tool results are produced) and yield normalized events.
   */
  async *run(input: AGUIRunInput): AsyncGenerator<RunnerEvent> {
    const { messages, state, registry, abortSignal, context } = input;
    const toolCalls = new Map<string, ToolCallState>();
    let currentMessages: Message[] = [...messages];

    // Replace once at the top: subsequent turns append to currentMessages
    // (per AG-UI convention — see footgun in apps/web AGENTS.md cross-link).
    this.httpAgent.setMessages(currentMessages);
    if (state) this.httpAgent.setState(state);

    try {
      for (;;) {
        if (abortSignal?.aborted) return;

        const tools: Tool[] = registry.getActiveSchemas();
        const queue = new EventQueue<RunnerEvent>();
        const runId = crypto.randomUUID();
        // Per-turn text accumulator. The model can emit text BEFORE a
        // tool call in the same turn ("Looking up X..." then ui_navigate);
        // dropping it from the follow-up replay changes the next-turn
        // context (no server-side thread state — full history rides each
        // request) and causes inconsistent continuations.
        let turnAssistantText = "";

        // Build the request input now, before runAgent fires — dev tooling
        // consumes this snapshot via the request-sent event. `runId` is
        // pre-generated so the snapshot matches what runAgent emits.
        const runInputSnapshot: Record<string, unknown> = {
          threadId: this.httpAgent.threadId,
          runId,
          state: { ...((this.httpAgent.state as Record<string, unknown>) || {}), ...(state ?? {}) },
          messages: currentMessages,
          tools,
          context: context ?? [],
        };

        queue.push({ type: "turn-started" });
        queue.push({ type: "streaming-status", status: { status: "thinking" } });
        queue.push({ type: "request-sent", input: runInputSnapshot });

        const subscriber: AgentSubscriber = {
          onRunStartedEvent: () => {
            queue.push({ type: "run-started" });
            queue.push({ type: "streaming-status", status: { status: "thinking" } });
          },
          onTextMessageStartEvent: () => {
            queue.push({ type: "streaming-status", status: { status: "streaming" } });
          },
          onTextMessageContentEvent: ({ event }) => {
            turnAssistantText += event.delta;
            queue.push({ type: "text-delta", delta: event.delta });
          },
          onTextMessageEndEvent: () => {
            queue.push({ type: "text-message-end" });
          },
          onToolCallStartEvent: ({ event }) => {
            const id = event.toolCallId;
            const name = event.toolCallName;
            toolCalls.set(id, { id, name, args: "" });
            queue.push({
              type: "streaming-status",
              status: { status: "calling", toolName: name },
            });
            queue.push({
              type: "tool-call-start",
              id,
              name,
              isClientSide: registry.isRegistered(name),
            });
          },
          onToolCallArgsEvent: ({ event }) => {
            const tc = toolCalls.get(event.toolCallId);
            if (tc) tc.args += event.delta;
            queue.push({ type: "tool-call-args", id: event.toolCallId, delta: event.delta });
          },
          onToolCallEndEvent: async ({ event }) => {
            const tc = toolCalls.get(event.toolCallId);
            if (!tc) return;

            // Intercept client-side tools — execute locally and stash the
            // result so the multi-turn loop can replay it on the next turn.
            if (registry.isRegistered(tc.name)) {
              try {
                const resultJson = await registry.executeTool(tc.name, tc.args);
                tc.result = JSON.parse(resultJson);
              } catch (err) {
                tc.result = {
                  error: err instanceof Error ? err.message : "Client-side tool failed",
                };
                tc.isError = true;
              }
            }

            queue.push({
              type: "tool-call-end",
              id: event.toolCallId,
              args: tc.args,
              result: tc.result,
              isError: tc.isError,
            });
          },
          onToolCallResultEvent: ({ event }) => {
            const tc = toolCalls.get(event.toolCallId);
            if (!tc) return;

            const content = event.content;
            let parsedResult: unknown = content;
            let isError = false;
            try {
              const parsed = JSON.parse(content);
              parsedResult = parsed;
              if (parsed && typeof parsed === "object" && "error" in parsed) {
                isError = true;
              }
            } catch {
              parsedResult = content;
            }
            tc.result = parsedResult;
            tc.isError = isError;
            queue.push({
              type: "tool-call-result",
              id: event.toolCallId,
              result: parsedResult,
              isError,
            });
          },
          onRunFinishedEvent: () => {
            queue.push({ type: "streaming-status", status: { status: "idle" } });
            queue.push({ type: "run-finished" });
          },
          onRunErrorEvent: ({ event }) => {
            queue.push({ type: "streaming-status", status: { status: "idle" } });
            queue.push({ type: "run-error", message: event.message ?? "Run error" });
          },
        };

        // Wire abort: AG-UI exposes abortRun(); call it when the caller's signal fires.
        const onAbort = () => this.httpAgent.abortRun();
        abortSignal?.addEventListener("abort", onAbort, { once: true });

        // Kick off the run — completion ends the queue. Errors during the
        // run surface via onRunErrorEvent; transport-level rejections
        // (e.g. fetch failure) are propagated through queue.end(err).
        const runPromise = this.httpAgent
          .runAgent({ runId, tools, context: context ?? [] }, subscriber)
          .then(() => queue.end())
          .catch((err: unknown) => queue.end(err));

        try {
          for await (const evt of queue.drain()) {
            yield evt;
            if (abortSignal?.aborted) {
              this.httpAgent.abortRun();
              return;
            }
          }
        } finally {
          abortSignal?.removeEventListener("abort", onAbort);
          await runPromise; // ensure the run task is settled
        }

        // Decide whether to re-issue: any client-side tool that resolved
        // during this turn and hasn't been replayed yet.
        const pendingClientTools = Array.from(toolCalls.values()).filter(
          (tc) => registry.isRegistered(tc.name) && tc.result !== undefined && !tc.followedUp,
        );
        if (pendingClientTools.length === 0) break;

        for (const tc of pendingClientTools) tc.followedUp = true;

        // Build follow-up messages with the SAME toolCallId the agent emitted.
        // Tool results are appended to the agent's message history (AG-UI
        // convention — append, never replace). Preserve any pre-tool text
        // the model emitted in this turn so the next-turn context matches
        // what the user actually saw.
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: turnAssistantText,
          toolCalls: pendingClientTools.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          })),
        };

        const toolResultMsgs: Message[] = pendingClientTools.map((tc) => ({
          id: crypto.randomUUID(),
          role: "tool",
          toolCallId: tc.id,
          content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
        }));

        currentMessages = [...currentMessages, assistantMsg, ...toolResultMsgs];
        for (const m of [assistantMsg, ...toolResultMsgs]) {
          this.httpAgent.addMessage(m);
        }
      }
    } finally {
      // Normalized terminal status — idempotent if onRunFinishedEvent already
      // fired one. Consumers ignore duplicate idle transitions.
      yield { type: "streaming-status", status: { status: "idle" } };
    }
  }
}
