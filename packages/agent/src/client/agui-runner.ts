/**
 * AG-UI Runner — protocol engine for `@lykomi/agent`.
 *
 * Drives the AG-UI SDK's `HttpAgent.runAgent()` with an `AgentSubscriber`,
 * fans the subscriber callbacks out as a normalized `RunnerEvent` stream,
 * and re-issues the run with appended assistant + tool messages whenever a
 * client-side tool produces a result.
 *
 * Framework-agnostic — no React, no `@assistant-ui/*`. The assistant-ui shim
 * in `@lykomi/web-ui` (and future Outlook / Teams / native shells)
 * translate `RunnerEvent`s into their own model.
 *
 * @see https://docs.ag-ui.com/sdk/js/client/http-agent
 * @see https://docs.ag-ui.com/sdk/js/client/subscriber
 */

import { HttpAgent, type AgentSubscriber } from "@ag-ui/client";
import type { Context, Message, Tool } from "@ag-ui/core";
import type { ToolRegistry } from "../tools/registry.ts";
import type { RunnerEvent } from "./runner-events.ts";
import type { StreamingStatus } from "../store/streaming-status-store.ts";
import { reasoningEffortStore } from "../store/reasoning-effort-store.ts";

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
  /**
   * Emit a `streaming-status: stalled` event when no AG-UI event (including
   * server heartbeats) has arrived for this many ms during an active run.
   * The status recovers automatically on the next event. Default 45s —
   * three missed 15s server heartbeats. Pass `Infinity` to disable.
   */
  stallAfterMs?: number;
  /**
   * When a run ends with a client-side tool call that never produced a
   * result, synthesize an error result for it instead of leaving the call
   * dangling. Defaults to `true`.
   *
   * Defence-in-depth for the failure this runner already had once: an
   * unanswered tool call makes the model re-issue the tool and then report
   * that it "didn't complete", while the Responses API rejects a replayed
   * history whose `function_call` has no matching output.
   */
  autoCancelPendingToolCalls?: boolean;
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

function shouldPreserveAcrossVisibleHistory(message: Message): boolean {
  return message.role === "system" || message.role === "developer" || message.role === "reasoning";
}

function mergeProtocolMessagesFromSnapshot(
  previousMessages: Message[],
  visibleMessages: Message[],
): Message[] {
  if (previousMessages.length === 0) return [...visibleMessages];

  const visibleById = new Map(visibleMessages.map((message) => [message.id, message]));
  const previousVisibleIds = new Set(
    previousMessages
      .filter((message) => !shouldPreserveAcrossVisibleHistory(message))
      .map((message) => message.id),
  );
  const isSameVisibleThread = visibleMessages.some((message) => previousVisibleIds.has(message.id));
  if (!isSameVisibleThread) return [...visibleMessages];

  const merged: Message[] = [];
  const emitted = new Set<string>();

  for (const previous of previousMessages) {
    const currentVisible = visibleById.get(previous.id);
    if (currentVisible) {
      merged.push(currentVisible);
      emitted.add(currentVisible.id);
      continue;
    }

    if (shouldPreserveAcrossVisibleHistory(previous)) {
      merged.push(previous);
      emitted.add(previous.id);
    }
  }

  for (const message of visibleMessages) {
    if (!emitted.has(message.id)) {
      merged.push(message);
    }
  }

  return merged;
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
  private readonly stallAfterMs: number;
  private readonly autoCancelPendingToolCalls: boolean;

  constructor(options: AGUIRunnerOptions = {}) {
    this.httpAgent = new HttpAgent({
      url: options.url ?? "/api/agent",
      threadId: options.threadId ?? crypto.randomUUID(),
      ...(options.fetchFn ? { fetch: options.fetchFn } : {}),
    });
    this.stallAfterMs = options.stallAfterMs ?? 45_000;
    this.autoCancelPendingToolCalls = options.autoCancelPendingToolCalls ?? true;
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
    let currentMessages: Message[] = mergeProtocolMessagesFromSnapshot(
      this.httpAgent.messages,
      messages,
    );

    // Replace once at the top with the reconciled AG-UI history. assistant-ui
    // stores only visible chat turns, while AG-UI snapshots may contain
    // model-visible but UI-hidden protocol messages such as system/developer
    // guidance. Preserve those messages across turns when the visible history
    // belongs to the same thread so the next request remains a complete AG-UI
    // conversation without leaking system messages into the rendered chat.
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
        // The user's reasoning-effort choice rides on every turn as an
        // AG-UI forwardedProp — read at request time so changing it
        // mid-conversation takes effect on the next message. "default"
        // sends nothing, which is what makes the backend's own configured
        // level apply; the picker shows the user what that resolves to.
        const chosenEffort = reasoningEffortStore.getState().effort;
        const forwardedProps: Record<string, unknown> =
          chosenEffort === "default" ? {} : { reasoningEffort: chosenEffort };

        const runInputSnapshot: Record<string, unknown> = {
          threadId: this.httpAgent.threadId,
          runId,
          state: { ...((this.httpAgent.state as Record<string, unknown>) || {}), ...(state ?? {}) },
          messages: currentMessages,
          tools,
          context: context ?? [],
          forwardedProps,
        };

        // --- Liveness + protocol-integrity bookkeeping (per turn) ---
        // AG-UI requires a terminal RUN_FINISHED or RUN_ERROR. A stream that
        // merely closes (proxy idle-timeout, dropped connection, dead
        // replica) would otherwise look like a clean completion and a
        // truncated answer would render as final — the silent-wedge bug.
        let sawTerminal = false;
        let stalled = false;
        let lastStatus: StreamingStatus = { status: "thinking" };
        let lastEventAt = Date.now();
        const push = (evt: RunnerEvent): void => {
          lastEventAt = Date.now();
          if (evt.type === "streaming-status") {
            if (evt.status.status === "stalled") {
              stalled = true;
            } else {
              lastStatus = evt.status;
              stalled = false;
            }
            queue.push(evt);
            return;
          }
          if (stalled) {
            // First live signal after a stall — restore the pre-stall phase.
            stalled = false;
            queue.push({ type: "streaming-status", status: lastStatus });
          }
          queue.push(evt);
        };
        const stallTimer = Number.isFinite(this.stallAfterMs)
          ? setInterval(
              () => {
                if (stalled || sawTerminal) return;
                if (Date.now() - lastEventAt >= this.stallAfterMs) {
                  push({ type: "streaming-status", status: { status: "stalled" } });
                }
              },
              Math.min(5_000, Math.max(25, Math.floor(this.stallAfterMs / 3))),
            )
          : null;

        push({ type: "turn-started" });
        push({ type: "streaming-status", status: { status: "thinking" } });
        push({ type: "request-sent", input: runInputSnapshot });

        const subscriber: AgentSubscriber = {
          onRunStartedEvent: () => {
            push({ type: "run-started" });
            push({ type: "streaming-status", status: { status: "thinking" } });
          },
          onTextMessageStartEvent: () => {
            push({ type: "streaming-status", status: { status: "streaming" } });
          },
          onTextMessageContentEvent: ({ event }) => {
            turnAssistantText += event.delta;
            push({ type: "text-delta", delta: event.delta });
          },
          onTextMessageEndEvent: () => {
            push({ type: "text-message-end" });
          },
          // Reasoning/thinking. `@ag-ui/client` normalizes the deprecated
          // THINKING_* events onto REASONING_* via its backward-compat
          // middleware, so subscribing here covers both wire dialects.
          onReasoningMessageStartEvent: () => {
            push({ type: "streaming-status", status: { status: "reasoning" } });
          },
          onReasoningMessageContentEvent: ({ event }) => {
            push({ type: "reasoning-delta", delta: event.delta });
          },
          onReasoningEndEvent: () => {
            push({ type: "reasoning-end" });
            // Reasoning ended but the answer hasn't started — back to the
            // generic working state rather than leaving "reasoning" stuck.
            push({ type: "streaming-status", status: { status: "thinking" } });
          },
          onStepStartedEvent: ({ event }) => {
            push({ type: "step-started", name: event.stepName });
            push({
              type: "streaming-status",
              status: { status: lastStatus.status, stepName: event.stepName },
            });
          },
          onStepFinishedEvent: ({ event }) => {
            push({ type: "step-finished", name: event.stepName });
          },
          // Reasoning has two nested boundaries: a BLOCK
          // (REASONING_START…REASONING_END) may contain several MESSAGES
          // (REASONING_MESSAGE_START…REASONING_MESSAGE_END). `reasoning-end`
          // means "the model stopped thinking", so it is emitted only for the
          // block terminal in `onReasoningEndEvent`. Emitting it per message
          // too would fire it repeatedly and let consumers treat reasoning as
          // finished while it is still going.
          onReasoningStartEvent: () => {
            push({ type: "streaming-status", status: { status: "reasoning" } });
          },
          // Server-published agent state. The AG-UI client has already
          // applied the snapshot/patch to `httpAgent.state`; forward the
          // result so consumers don't reach into the client.
          onStateSnapshotEvent: () => {
            push({ type: "agent-state", state: this.httpAgent.state });
          },
          onStateDeltaEvent: ({ event }) => {
            push({
              type: "agent-state",
              state: this.httpAgent.state,
              patch: event.delta as unknown[],
            });
          },
          // Server-authoritative history (e.g. after backend compaction).
          // Deliberately does NOT touch the in-flight turn: upstream saw
          // mid-run snapshots truncate a streaming answer.
          onMessagesSnapshotEvent: ({ event }) => {
            push({ type: "messages-snapshot", messages: event.messages as unknown[] });
          },
          // Generative-UI surfaces (MCP apps / A2UI), passed through.
          onActivitySnapshotEvent: ({ event }) => {
            push({
              type: "activity",
              messageId: event.messageId,
              activityType: event.activityType,
              content: event.content,
            });
          },
          onActivityDeltaEvent: ({ event }) => {
            push({
              type: "activity",
              messageId: event.messageId,
              activityType: event.activityType,
              patch: event.patch as unknown[],
            });
          },
          // Provider passthrough — never interpreted here.
          onRawEvent: ({ event }) => {
            push({ type: "raw", event: event.event, source: event.source });
          },
          onCustomEvent: ({ event }) => {
            // Token usage of a model call (Agent Framework emits one per
            // response). Only well-formed counts pass; the event is ignored
            // otherwise rather than reported as zero.
            if (event.name === "usage") {
              const value = event.value as Record<string, unknown> | null | undefined;
              const input = value?.input_token_count;
              const output = value?.output_token_count;
              const used = value?.context_used_tokens;
              const limit = value?.context_limit_tokens;
              const count = (n: unknown): n is number =>
                typeof n === "number" && Number.isFinite(n) && n >= 0;
              if (count(input)) {
                push({
                  type: "usage",
                  inputTokens: input,
                  ...(count(output) ? { outputTokens: output } : {}),
                  // Only as a pair: a fill without its ceiling means nothing.
                  ...(count(used) && count(limit) && limit > 0
                    ? { contextUsed: used, contextLimit: limit }
                    : {}),
                });
              }
              return;
            }
            // Server-reported activity between model calls ("Compacting
            // chat…"); a null label means it finished and the run is back to
            // thinking until the next event says otherwise.
            if (event.name === "activity") {
              const label = (event.value as { label?: unknown } | null | undefined)?.label;
              push({
                type: "streaming-status",
                status:
                  typeof label === "string" && label
                    ? { status: "working", label: label.slice(0, 80) }
                    : { status: "thinking" },
              });
              return;
            }
            // Server heartbeat: liveness proof during long tool calls /
            // thinking phases (also keeps intermediary idle-timeouts at bay
            // server-side). Not a UI-visible event.
            if (event.name !== "heartbeat") return;
            const value = event.value as { elapsedMs?: number } | null | undefined;
            push({
              type: "heartbeat",
              ...(typeof value?.elapsedMs === "number" ? { elapsedMs: value.elapsedMs } : {}),
            });
          },
          onToolCallStartEvent: ({ event }) => {
            const id = event.toolCallId;
            const name = event.toolCallName;
            toolCalls.set(id, { id, name, args: "" });
            push({
              type: "streaming-status",
              status: { status: "calling", toolName: name },
            });
            push({
              type: "tool-call-start",
              id,
              name,
              isClientSide: registry.isRegistered(name),
            });
          },
          onToolCallArgsEvent: ({ event }) => {
            const tc = toolCalls.get(event.toolCallId);
            if (tc) tc.args += event.delta;
            push({ type: "tool-call-args", id: event.toolCallId, delta: event.delta });
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

            push({
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
            // The SERVER answered this call, so its run already carries the
            // result and continues on its own. A host may still register the
            // same tool locally for its UI effect (open a panel, highlight a
            // row) and run it at `tool-call-end`, but replaying that local
            // result as a continuation would hand the model a second answer
            // to a call it has already seen answered. This is what lets a
            // server take purely cosmetic UI tools off the browser's critical
            // path: a hidden tab that the browser freezes cannot post a
            // continuation, and a turn that waits for one waits until
            // somebody looks at the tab again.
            tc.followedUp = true;
            push({
              type: "tool-call-result",
              id: event.toolCallId,
              result: parsedResult,
              isError,
            });
          },
          onRunFinishedEvent: () => {
            sawTerminal = true;
            push({ type: "streaming-status", status: { status: "idle" } });
            push({ type: "run-finished" });
          },
          onRunErrorEvent: ({ event }) => {
            sawTerminal = true;
            push({ type: "streaming-status", status: { status: "idle" } });
            push({ type: "run-error", message: event.message ?? "Run error" });
          },
        };

        // Wire abort: AG-UI exposes abortRun(); call it when the caller's signal fires.
        const onAbort = () => this.httpAgent.abortRun();
        abortSignal?.addEventListener("abort", onAbort, { once: true });

        // Kick off the run — completion ends the queue. Errors during the
        // run surface via onRunErrorEvent. Two failure shapes are normalized
        // onto the same `run-error` surface so every failure renders in chat
        // instead of dying silently:
        //   1. The stream closed WITHOUT a terminal RUN_FINISHED/RUN_ERROR
        //      (proxy idle-timeout, dropped connection, dead replica) — the
        //      AG-UI client treats that as a clean completion, so we detect
        //      the protocol violation here.
        //   2. Transport-level rejection (fetch failure, TLS reset).
        const runPromise = this.httpAgent
          .runAgent({ runId, tools, context: context ?? [], forwardedProps }, subscriber)
          .then(() => {
            if (!sawTerminal && !abortSignal?.aborted) {
              push({ type: "streaming-status", status: { status: "idle" } });
              push({
                type: "run-error",
                message:
                  "Connection to the agent was lost before the response finished — " +
                  "the answer may be incomplete. Please retry.",
              });
            }
            queue.end();
          })
          .catch((err: unknown) => {
            if (!sawTerminal && !abortSignal?.aborted) {
              push({ type: "streaming-status", status: { status: "idle" } });
              push({
                type: "run-error",
                message: err instanceof Error ? err.message : "The request to the agent failed.",
              });
            }
            queue.end();
          });

        try {
          for await (const evt of queue.drain()) {
            yield evt;
            if (abortSignal?.aborted) {
              this.httpAgent.abortRun();
              return;
            }
          }
        } finally {
          if (stallTimer !== null) clearInterval(stallTimer);
          abortSignal?.removeEventListener("abort", onAbort);
          await runPromise; // ensure the run task is settled
        }

        // Any client-side tool that was STARTED but never produced a
        // result leaves a `function_call` with no output. Settle it here so
        // the replayed history stays valid and the model isn't left waiting
        // on an answer that will never come.
        if (this.autoCancelPendingToolCalls) {
          for (const tc of toolCalls.values()) {
            if (!registry.isRegistered(tc.name)) continue;
            if (tc.result !== undefined || tc.followedUp) continue;
            tc.result = { error: "Tool call did not complete before the run ended." };
            tc.isError = true;
            yield {
              type: "tool-call-result",
              id: tc.id,
              result: tc.result,
              isError: true,
            };
          }
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
        // convention — append, never replace).
        //
        // The AG-UI client folds the streamed assistant message — tool calls
        // included — into `httpAgent.messages` itself (AbstractAgent applies
        // the event stream to its own history). Appending an unconditional
        // second copy put the SAME toolCallId in the history twice with only
        // one matching tool result, so the model saw an unanswered tool call:
        // it re-issued the tool (a duplicate card in the UI) and then reported
        // that the call "didn't complete", even though the tool had succeeded.
        // Only synthesize what the client hasn't already recorded.
        const recordedToolCallIds = new Set<string>();
        const recordedToolResultIds = new Set<string>();
        for (const message of this.httpAgent.messages) {
          if (message.role === "assistant" && message.toolCalls) {
            for (const call of message.toolCalls) recordedToolCallIds.add(call.id);
          } else if (message.role === "tool" && message.toolCallId) {
            recordedToolResultIds.add(message.toolCallId);
          }
        }

        const followUpMessages: Message[] = [];

        // Preserve any pre-tool text the model emitted in this turn so the
        // next-turn context matches what the user actually saw.
        const unrecordedToolCalls = pendingClientTools.filter(
          (tc) => !recordedToolCallIds.has(tc.id),
        );
        if (unrecordedToolCalls.length > 0) {
          followUpMessages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: turnAssistantText,
            toolCalls: unrecordedToolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          });
        }

        for (const tc of pendingClientTools) {
          if (recordedToolResultIds.has(tc.id)) continue;
          followUpMessages.push({
            id: crypto.randomUUID(),
            role: "tool",
            toolCallId: tc.id,
            content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
          });
        }

        for (const m of followUpMessages) {
          this.httpAgent.addMessage(m);
        }
        // Re-sync from the client's history: it is the authority on what the
        // next request carries (`prepareRunAgentInput` reads it directly).
        currentMessages = [...this.httpAgent.messages];
      }
    } finally {
      // Normalized terminal status — idempotent if onRunFinishedEvent already
      // fired one. Consumers ignore duplicate idle transitions.
      yield { type: "streaming-status", status: { status: "idle" } };
    }
  }
}
