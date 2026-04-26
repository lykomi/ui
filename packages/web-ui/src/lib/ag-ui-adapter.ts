/**
 * AG-UI Adapter for assistant-ui.
 *
 * Thin shim around `@lastspace/agent`'s `AGUIRunner`:
 *   - converts assistant-ui `Message[]` → AG-UI `Message[]` on input,
 *   - feeds the runner, drains its `RunnerEvent` stream,
 *   - accumulates text + tool-call state,
 *   - yields cumulative `ChatModelRunResult` snapshots (assistant-ui requires
 *     each yield to carry the *complete* content array — never deltas).
 *
 * Wires the React-only stores that don't belong in `@lastspace/agent`:
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
  TextMessagePart,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type { Message as AGUIMessage } from "@ag-ui/core";
import {
  AGUIRunner,
  clientToolRegistry,
  streamingStatusStore,
} from "@lastspace/agent";
import { tokenFetch } from "@lastspace/agent/msal";
import { useAppStore } from "./app-store.ts";
import { useDevStore } from "./dev-store.ts";

interface ToolCallSnapshot {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  isError?: boolean;
}

export class AGUIAdapterSDK implements ChatModelAdapter {
  private readonly runner: AGUIRunner;

  constructor(
    url: string = "/api/agent",
    options?: { threadId?: string; fetchFn?: typeof fetch },
  ) {
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
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      useAppStore.getState().consumeContextForMessage(lastUserMsg.id);
    }

    let currentText = "";
    const toolCalls = new Map<string, ToolCallSnapshot>();
    let runError: string | null = null;

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
    const buildResult = (
      statusOverride?: ChatModelRunResult["status"],
    ): ChatModelRunResult => {
      const content: (ToolCallMessagePart | TextMessagePart)[] = [];

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
        state: appState as unknown as Record<string, unknown>,
        registry: clientToolRegistry.getState(),
        abortSignal,
      })) {
        let shouldYield = false;

        switch (event.type) {
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
            streamingStatusStore.getState().setStreamingStatus(event.status);
            break;

          case "text-delta":
            currentText += event.delta;
            shouldYield = true;
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
      // `status` is `running`, so we always emit a final `complete` once
      // the runner is fully done (after every turn + every follow-up).
      // `runError` is recorded above but not re-thrown: the terminal yield
      // settles the message with reason=stop so the bubble unsticks; an
      // unhandled throw would re-introduce the stuck-running bug.
      void runError;
      yield buildResult({ type: "complete", reason: "stop" });
    } finally {
      streamingStatusStore.getState().setStreamingStatus({ status: "idle" });
    }
  }
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
    out.push({ id, role: "user", content: hasBinary ? parts : textContent });
  }

  return out;
}
