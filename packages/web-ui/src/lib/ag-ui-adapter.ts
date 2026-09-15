/**
 * AG-UI Adapter for assistant-ui.
 *
 * Thin shim around `@iloveagents/foundry-agent`'s `AGUIRunner`:
 *   - converts assistant-ui `Message[]` → AG-UI `Message[]` on input,
 *   - feeds the runner, drains its `RunnerEvent` stream,
 *   - accumulates text + tool-call state,
 *   - yields cumulative `ChatModelRunResult` snapshots (assistant-ui requires
 *     each yield to carry the *complete* content array — never deltas).
 *
 * Wires the React-only stores that don't belong in `@iloveagents/foundry-agent`:
 *   - `useAppStore` for context-item snapshot + lifecycle hooks
 *   - `useDevStore` for dev-panel request/tool capture (driven by the
 *     runner's `request-sent` event).
 *
 * @see https://docs.ag-ui.com/sdk/js/client/http-agent
 * @see https://www.assistant-ui.com/docs/runtimes/custom/local
 */

import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ReasoningMessagePart,
  TextMessagePart,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { Context, Message as AGUIMessage } from "@ag-ui/core";
import { AGUIRunner, clientToolRegistry } from "@iloveagents/foundry-agent";
import { tokenFetch } from "@iloveagents/foundry-agent/msal";
import { useAppStore, type AgentStateProjection } from "./app-store.ts";
import { useDevStore } from "./dev-store.ts";

import {
  publishChatAgentState,
  beginChatRun,
  touchChatRun,
  updateChatRun,
  isForegroundChat,
  waitForForegroundChat,
} from "./chat-runs-store.ts";

interface ToolCallSnapshot {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  isError?: boolean;
}

export class AGUIAdapterSDK implements ChatModelAdapter {
  private readonly runner: AGUIRunner;
  private readonly conversationUrl?: string;

  constructor(
    url: string = "/api/agent",
    options?: { threadId?: string; fetchFn?: typeof fetch; conversationUrl?: string },
  ) {
    this.conversationUrl = options?.conversationUrl;
    this.runner = new AGUIRunner({
      url,
      threadId: options?.threadId,
      fetchFn: options?.fetchFn ?? tokenFetch,
    });
  }

  get threadId(): string {
    return this.runner.threadId;
  }

  get state(): unknown {
    return this.runner.state;
  }

  async *run({ messages, abortSignal }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
    const aguiMessages = convertMessagesToAGUI(messages);

    // App-level lifecycle: mark thread active, snapshot context, consume
    // ephemeral context off the last user message.
    useAppStore.getState().markThreadActive();
    const appState = useAppStore.getState().getAgentState();
    const context = buildAGUIContext(appState);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      useAppStore.getState().consumeContextForMessage(lastUserMsg.id);
    }

    let currentText = "";
    // Reasoning accumulates across the WHOLE run, unlike `currentText` which
    // is per-turn: the collapsed reasoning panel shouldn't lose what the model
    // thought before a tool call just because the runner re-issued the turn.
    let currentReasoning = "";
    const toolCalls = new Map<string, ToolCallSnapshot>();
    let runError: string | null = null;

    // Liveness clock for the working indicator: every runner event (incl.
    // server heartbeats) proves the run is alive; the indicator derives
    // elapsed time from runStartedAt and staleness from lastSignalAt.
    const stopController = new AbortController();
    const runSignal = AbortSignal.any([abortSignal, stopController.signal]);
    beginChatRun({
      threadId: this.threadId,
      conversationUrl: this.conversationUrl,
      title:
        lastUserMsg?.content
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(" ")
          .slice(0, 120) || "Conversation",
      pageLabel: useAppStore.getState().navContext.label ?? undefined,
      contextMeta: { ...useAppStore.getState().navContext.meta },
      stop: () => stopController.abort(),
    });
    const registry = clientToolRegistry.getState();
    const schemas = registry.getActiveSchemas();
    const advertised = new Set(schemas.map((tool) => tool.name));

    /**
     * Build a `ChatModelRunResult` from the accumulated state.
     *
     * Per assistant-ui v0.12 contract, every yield must carry the COMPLETE
     * cumulative content array (not deltas). The runner drives multi-turn
     * follow-ups internally; we yield `running` for every intermediate
     * yield, then a single terminal `complete` after the runner's
     * generator returns. assistant-ui leaves the message stuck in the
     * loading state if the last yield's status is `running`.
     */
    const buildResult = (statusOverride?: ChatModelRunResult["status"]): ChatModelRunResult => {
      const content: (ToolCallMessagePart | TextMessagePart | ReasoningMessagePart)[] = [];

      // Reasoning first: it precedes the answer chronologically, and
      // assistant-ui renders parts in array order.
      if (currentReasoning) {
        content.push({ type: "reasoning", text: currentReasoning });
      }

      for (const [id, tc] of toolCalls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(tc.args || "{}");
        } catch {
          // Keep empty object for invalid JSON
        }
        content.push({
          type: "tool-call",
          toolCallId: id,
          toolName: tc.name,
          args: parsedArgs as ToolCallMessagePart["args"],
          argsText: tc.args,
          result: tc.result,
          isError: tc.isError,
        });
      }

      if (currentText) {
        content.push({ type: "text", text: currentText });
      }

      const status: ChatModelRunResult["status"] = statusOverride ?? { type: "running" };

      return {
        content,
        status,
        metadata: {
          custom: {
            threadId: this.runner.threadId,
            timestamp: Date.now(),
            state: this.runner.state,
          },
        },
      };
    };

    try {
      for await (const event of this.runner.run({
        messages: aguiMessages,
        state: {
          ...(this.runner.state && typeof this.runner.state === "object" ? this.runner.state : {}),
          ...appState,
        } as unknown as Record<string, unknown>,
        context,
        registry: {
          ...registry,
          getActiveSchemas: () => schemas,
          isRegistered: (name) => advertised.has(name),
          executeTool: async (name, args) => {
            await waitForForegroundChat(this.threadId, runSignal);
            runSignal.throwIfAborted();
            if (!clientToolRegistry.getState().isRegistered(name)) {
              updateChatRun(this.threadId, "waiting");
              await new Promise<void>((resolve, reject) => {
                const cleanup = () => {
                  unsubscribe();
                  runSignal.removeEventListener("abort", aborted);
                };
                const aborted = () => {
                  cleanup();
                  reject(runSignal.reason);
                };
                const unsubscribe = clientToolRegistry.subscribe(() => {
                  if (clientToolRegistry.getState().isRegistered(name)) {
                    cleanup();
                    resolve();
                  }
                });
                runSignal.addEventListener("abort", aborted, { once: true });
                if (runSignal.aborted) aborted();
                else if (clientToolRegistry.getState().isRegistered(name)) {
                  cleanup();
                  resolve();
                }
              });
              await waitForForegroundChat(this.threadId, runSignal);
              updateChatRun(this.threadId, "running");
            }
            return clientToolRegistry.getState().executeTool(name, args);
          },
        },
        abortSignal: runSignal,
      })) {
        let shouldYield = false;
        touchChatRun(this.threadId);

        switch (event.type) {
          case "heartbeat":
            // Server liveness ping — already recorded via touchSignal above.
            break;

          case "request-sent":
            if (import.meta.env.DEV) {
              useDevStore.getState().captureRequest(event.input);
            }
            break;

          case "turn-started":
            currentText = "";
            shouldYield = true;
            break;

          case "run-started":
            // Per-turn signal — the runner may issue multiple turns for
            // multi-turn tool follow-ups. Terminal completion is yielded
            // post-loop, not on the per-turn run-finished.
            break;

          case "run-finished":
            // Intermediate yield — keeps the message in the running state
            // while the runner decides whether to re-issue.
            shouldYield = true;
            break;

          case "run-error":
            runError = event.message;
            console.error("Run error:", event.message);
            shouldYield = true;
            break;

          case "streaming-status":
            touchChatRun(this.threadId, event.status);
            break;

          case "text-delta":
            currentText += event.delta;
            shouldYield = true;
            break;

          case "reasoning-delta":
            currentReasoning += event.delta;
            shouldYield = true;
            break;

          case "reasoning-end":
            shouldYield = true;
            break;

          case "agent-state":
            // Publish server state so pages can react to it. Not a chat
            // message, so no yield.
            publishChatAgentState(this.threadId, event.state, event.patch);
            break;

          case "messages-snapshot":
          case "activity":
          case "raw":
            // Protocol surfaces this adapter deliberately does not render:
            // history reconciliation, generative-UI activities and provider
            // passthrough belong to the host app, which can consume the
            // RunnerEvent stream directly. Handled here so the switch stays
            // exhaustive and they can never silently become "unknown".
            break;

          case "step-started":
          case "step-finished":
            // Progress only — the status store already carries the step name
            // (pushed by the runner alongside these events).
            break;

          case "text-message-end":
            shouldYield = true;
            break;

          case "tool-call-start":
            toolCalls.set(event.id, { id: event.id, name: event.name, args: "" });
            if (import.meta.env.DEV) {
              useDevStore.getState().addToolCall({
                id: event.id,
                name: event.name,
                args: "",
                isClientSide: event.isClientSide,
                timestamp: Date.now(),
              });
            }
            shouldYield = true;
            break;

          case "tool-call-args": {
            const tc = toolCalls.get(event.id);
            if (tc) {
              tc.args += event.delta;
              shouldYield = true;
            }
            break;
          }

          case "tool-call-end": {
            const tc = toolCalls.get(event.id);
            if (tc) {
              tc.args = event.args;
              if (event.result !== undefined) tc.result = event.result;
              if (event.isError !== undefined) tc.isError = event.isError;
              if (import.meta.env.DEV) {
                useDevStore.getState().updateToolCall(event.id, {
                  args: tc.args,
                  result: tc.result,
                });
              }
              shouldYield = true;
            }
            break;
          }

          case "tool-call-result": {
            const tc = toolCalls.get(event.id);
            if (tc) {
              tc.result = event.result;
              tc.isError = event.isError;
              if (import.meta.env.DEV) {
                useDevStore.getState().updateToolCall(event.id, {
                  result: tc.result,
                });
              }
              shouldYield = true;
            }
            break;
          }
        }

        if (shouldYield) {
          const result = buildResult();
          if ((result.content?.length ?? 0) > 0) {
            yield result;
          }
        }
      }

      // Terminal yield — runner generator returned. assistant-ui leaves
      // the message stuck in the loading state if the last yield's
      // `status` is `running`, so we always emit a final settle once the
      // runner is fully done (after every turn + every follow-up).
      //
      // If the run errored (the AG-UI backend emitted RUN_ERROR — e.g. the
      // agent exhausted rate-limit/transient retries, or a non-retryable
      // 4xx), settle as `incomplete`/`error` instead of `complete`/`stop`,
      // carrying the error message. This keeps any partial content AND
      // flips the message into assistant-ui's error state so the existing
      // `<MessagePrimitive.Error>` renders a visible, retryable error —
      // not a silent empty bubble. We yield the terminal status rather
      // than throwing; an unhandled throw re-introduces the stuck-running
      // bug (the runner generator has already returned here).
      if (runSignal.aborted) {
        yield buildResult({ type: "incomplete", reason: "cancelled" });
      } else if (runError !== null) {
        yield buildResult({
          type: "incomplete",
          reason: "error",
          error: runError || "The run failed.",
        });
      } else {
        yield buildResult({ type: "complete", reason: "stop" });
      }
    } catch (error) {
      if (runSignal.aborted) yield buildResult({ type: "incomplete", reason: "cancelled" });
      else {
        runError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    } finally {
      updateChatRun(
        this.threadId,
        runSignal.aborted ? "cancelled" : runError !== null ? "failed" : "completed",
        runError ?? undefined,
      );
    }
  }
}

function buildAGUIContext(appState: AgentStateProjection): Context[] {
  return appState.contextItems.map((item, index) => ({
    description: describeContextItem(item, index),
    value: stringifyContextItem(item),
  }));
}

function describeContextItem(item: Record<string, unknown>, index: number): string {
  const type = typeof item.type === "string" ? item.type : "context";
  const label = typeof item.label === "string" ? item.label : "";

  if (type === "ref") {
    const refType = typeof item.refType === "string" ? item.refType : "reference";
    const target = isRecord(item.target) ? item.target : undefined;
    const targetPath =
      typeof item.targetPath === "string"
        ? item.targetPath
        : typeof target?.path === "string"
          ? target.path
          : undefined;
    const targetLabel = typeof target?.label === "string" ? target.label : undefined;
    const targetScope = typeof target?.scope === "string" ? target.scope : undefined;
    if (targetPath) {
      if (!targetLabel && !targetScope) {
        return `Selected ${refType} atom. Use targetPath as the exact edit target when the user asks to modify, rewrite, or transform selected content.`;
      }
      const targetText = targetLabel || targetScope || "JSON atom";
      return `Selected ${refType} ${targetText}. Use targetPath as the exact JSON edit target when the user asks to modify, rewrite, or transform this reference.`;
    }
    return `Selected ${refType} reference. Use refId as the edit target when the user asks to modify, rewrite, or transform selected content.`;
  }

  if (type === "selection") {
    return "Selected text from the current UI. Use it as the focus when the user asks about, rewrites, or modifies selected content.";
  }

  if (type === "page") {
    return `Pinned page context${label ? `: ${label}` : ""}.`;
  }

  return `Context item ${index + 1}${label ? `: ${label}` : ""}.`;
}

function stringifyContextItem(item: Record<string, unknown>): string {
  try {
    return JSON.stringify(item);
  } catch {
    const type = typeof item.type === "string" ? item.type : "context";
    const label = typeof item.label === "string" ? item.label : "";
    return JSON.stringify({ type, label });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Convert assistant-ui's `Message[]` into AG-UI's wire format.
 *
 * Our Python backend doesn't keep server-side thread state, so prior turns'
 * tool calls + results need to ride along on every request.
 */
function convertMessagesToAGUI(messages: ChatModelRunOptions["messages"]): AGUIMessage[] {
  const out: AGUIMessage[] = [];

  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx];
    const id = msg.id || `msg-${idx}`;
    const textContent = msg.content
      .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    if (msg.role === "system") {
      out.push({ id, role: "system", content: textContent });
      continue;
    }

    if (msg.role === "assistant") {
      const toolCallParts = msg.content.filter(
        (c): c is Extract<typeof c, { type: "tool-call" }> => c.type === "tool-call",
      );

      if (toolCallParts.length > 0) {
        out.push({
          id,
          role: "assistant",
          content: textContent || undefined,
          toolCalls: toolCallParts.map((tc) => ({
            id: tc.toolCallId,
            type: "function" as const,
            function: {
              name: tc.toolName,
              arguments: tc.argsText ?? JSON.stringify(tc.args ?? {}),
            },
          })),
        });
        for (const tc of toolCallParts) {
          if (tc.result !== undefined) {
            out.push({
              id: `tool-result-${tc.toolCallId}`,
              role: "tool",
              toolCallId: tc.toolCallId,
              content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
            });
          }
        }
      } else {
        out.push({ id, role: "assistant", content: textContent });
      }
      continue;
    }

    // User role: extract binary attachments if present
    const parts: (
      | { type: "text"; text: string }
      | { type: "binary"; mimeType: string; data?: string; filename?: string }
    )[] = [];
    for (const c of msg.content) {
      if (c.type === "text") {
        parts.push({ type: "text", text: c.text });
      }
    }
    if ("attachments" in msg && Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (!att.content) continue;
        for (const part of att.content) {
          if (part.type === "text") {
            parts.push({ type: "text", text: part.text });
          } else if (part.type === "file" && "data" in part) {
            parts.push({
              type: "binary",
              mimeType: part.mimeType,
              data: part.data as string,
              filename: part.filename,
            });
          } else if (part.type === "image" && "image" in part) {
            parts.push({
              type: "binary",
              mimeType: "image/*",
              data: part.image as string,
            });
          }
        }
      }
    }

    const hasBinary = parts.some((p) => p.type === "binary");
    const textWithAttachments = parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    out.push({ id, role: "user", content: hasBinary ? parts : textWithAttachments });
  }

  return out;
}
