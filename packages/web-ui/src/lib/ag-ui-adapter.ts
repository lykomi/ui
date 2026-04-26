/**
 * AG-UI SDK Adapter for assistant-ui
 *
 * Custom adapter bridging AG-UI protocol to assistant-ui's async generator interface.
 * Uses raw fetch + manual SSE parsing (proven pattern from reference implementations)
 * for reliable multi-turn client tool support.
 *
 * Client-side tools are intercepted at TOOL_CALL_END, executed locally against
 * Zustand stores, and their results are sent back to the backend in a follow-up
 * request so the agent can continue generating text.
 *
 * HttpAgent is retained for threadId/state/messages tracking only.
 *
 * @see https://docs.ag-ui.com/sdk/js/core/overview - AG-UI Protocol
 * @see https://www.assistant-ui.com/ - assistant-ui Documentation
 */

import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  TextMessagePart,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import { HttpAgent } from "@ag-ui/client";
import type { BaseEvent, Message } from "@ag-ui/core";
import { useAppStore } from "./app-store.ts";
import { useStreamingStatusStore, type StreamingStatus } from "./streaming-status-store.ts";
import { useClientToolRegistry } from "./client-tool-registry.ts";
import { useDevStore } from "./dev-store.ts";
import { tokenFetch } from "./token-fetch.ts";

interface ToolCallState {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  isError?: boolean;
  isComplete: boolean;
  followedUp?: boolean;
}

/**
 * AG-UI to assistant-ui Adapter
 *
 * Streams AG-UI events via raw fetch + SSE and maps them to assistant-ui's
 * ChatModelRunResult async generator format. HttpAgent is retained for
 * threadId, state, and message tracking only.
 */
export class AGUIAdapterSDK implements ChatModelAdapter {
  private httpAgent: HttpAgent;
  private readonly url: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    url: string = "/api/agent",
    options?: { threadId?: string; fetchFn?: typeof fetch },
  ) {
    this.url = url;
    this.fetchFn = options?.fetchFn ?? tokenFetch;
    this.httpAgent = new HttpAgent({
      url,
      threadId: options?.threadId ?? crypto.randomUUID(),
    });
  }

  /** Parse an SSE response body into AG-UI events */
  private async *parseSSE(
    body: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<BaseEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                yield JSON.parse(jsonStr) as BaseEvent;
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }
  }

  /** Send a run request and return the SSE event stream */
  private async fetchSSE(
    runInput: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await this.fetchFn(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(runInput),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("No response body");
    return response.body;
  }

  async *run({ messages, abortSignal }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
    const registry = useClientToolRegistry.getState();

    // Convert assistant-ui messages to AG-UI format.
    // Our Python backend does not maintain server-side thread state, so we must
    // include tool calls and tool results from previous turns in the messages.
    const aguiMessages: Message[] = [];

    for (let idx = 0; idx < messages.length; idx++) {
      const msg = messages[idx];
      const id = msg.id || `msg-${idx}`;
      const textContent = msg.content
        .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      if (msg.role === "system") {
        aguiMessages.push({ id, role: "system", content: textContent });
        continue;
      }

      // Assistant role: may include tool-call parts from previous turns
      if (msg.role === "assistant") {
        const toolCallParts = msg.content.filter(
          (c): c is Extract<typeof c, { type: "tool-call" }> => c.type === "tool-call",
        );

        if (toolCallParts.length > 0) {
          aguiMessages.push({
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
              aguiMessages.push({
                id: `tool-result-${tc.toolCallId}`,
                role: "tool",
                toolCallId: tc.toolCallId,
                content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
              });
            }
          }
        } else {
          aguiMessages.push({ id, role: "assistant", content: textContent });
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
      aguiMessages.push({ id, role: "user", content: hasBinary ? parts : textContent });
    }

    // Mark thread as active on first message
    useAppStore.getState().markThreadActive();

    // Snapshot the state projection BEFORE consuming (includes all items)
    const appState = useAppStore.getState().getAgentState();

    // Consume context items: store snapshot for SentContextBadges, clear ephemeral
    let lastUserMsg: (typeof messages)[number] | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMsg = messages[i];
        break;
      }
    }
    if (lastUserMsg) {
      useAppStore.getState().consumeContextForMessage(lastUserMsg.id);
    }

    // State sent to agent — contextItems in the projection is the single source
    const contextState = appState;

    // State tracking for building assistant-ui content
    let currentText = "";
    const toolCalls = new Map<string, ToolCallState>();
    let runStatus: "running" | "complete" = "running";
    const setStreaming = (s: StreamingStatus) => {
      useStreamingStatusStore.getState().setStreamingStatus(s);
    };

    // Build yield result from current state
    const buildYield = (statusOverride?: ChatModelRunResult["status"]): ChatModelRunResult => {
      const content: (ToolCallMessagePart | TextMessagePart)[] = [];

      for (const [id, toolCall] of toolCalls) {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.args || "{}");
        } catch {
          // Keep empty object for invalid JSON
        }
        content.push({
          type: "tool-call" as const,
          toolCallId: id,
          toolName: toolCall.name,
          args: parsedArgs,
          argsText: toolCall.args,
          result: toolCall.result,
          isError: toolCall.isError,
        });
      }

      if (currentText) {
        content.push({ type: "text", text: currentText });
      }

      let status: ChatModelRunResult["status"];
      if (statusOverride) {
        status = statusOverride;
      } else if (runStatus === "complete") {
        // Don't yield "complete" if there are client tools needing follow-up
        const needsFollowUp = Array.from(toolCalls.values()).some(
          (tc) => registry.isRegistered(tc.name) && tc.result !== undefined && !tc.followedUp,
        );
        status = needsFollowUp ? { type: "running" } : { type: "complete", reason: "stop" };
      } else {
        status = { type: "running" };
      }

      return {
        content,
        status,
        metadata: {
          custom: {
            threadId: this.httpAgent.threadId,
            timestamp: Date.now(),
            state: this.httpAgent.state,
          },
        },
      };
    };

    // Multi-turn loop: each iteration sends a request and processes the SSE stream.
    // When client-side tools are called, their results are sent back in a follow-up
    // request so the agent can continue generating text.
    let currentMessages: unknown[] = aguiMessages;

    try {
      for (;;) {
        if (abortSignal?.aborted) break;

        setStreaming({ status: "thinking" });
        runStatus = "running";

        const runInput = {
          threadId: this.httpAgent.threadId,
          runId: crypto.randomUUID(),
          state: { ...(this.httpAgent.state || {}), ...contextState },
          messages: currentMessages,
          tools: registry.getActiveSchemas(),
          context: [],
        };

        // Capture for Dev Panel (dev mode)
        if (import.meta.env.DEV) {
          useDevStore.getState().captureRequest(runInput);
        }

        const body = await this.fetchSSE(runInput, abortSignal);

        for await (const event of this.parseSSE(body, abortSignal)) {
          if (abortSignal?.aborted) break;

          let shouldYield = false;

          switch (event.type) {
            case "RUN_STARTED":
              runStatus = "running";
              setStreaming({ status: "thinking" });
              break;

            case "RUN_FINISHED":
              runStatus = "complete";
              setStreaming({ status: "idle" });
              shouldYield = true;
              break;

            case "RUN_ERROR":
              runStatus = "complete";
              setStreaming({ status: "idle" });
              console.error("Run error:", (event as { message?: string }).message);
              shouldYield = true;
              break;

            case "TEXT_MESSAGE_START":
              currentText = "";
              setStreaming({ status: "streaming" });
              break;

            case "TEXT_MESSAGE_CONTENT":
              if ("delta" in event && event.delta) {
                currentText += event.delta as string;
                shouldYield = true;
              }
              break;

            case "TEXT_MESSAGE_END":
              shouldYield = true;
              break;

            case "TOOL_CALL_START":
              if ("toolCallId" in event && "toolCallName" in event) {
                const toolCallId = event.toolCallId as string;
                const toolCallName = event.toolCallName as string;
                toolCalls.set(toolCallId, {
                  id: toolCallId,
                  name: toolCallName,
                  args: "",
                  isComplete: false,
                });
                setStreaming({ status: "calling", toolName: toolCallName });
                if (import.meta.env.DEV) {
                  useDevStore.getState().addToolCall({
                    id: toolCallId,
                    name: toolCallName,
                    args: "",
                    isClientSide: registry.isRegistered(toolCallName),
                    timestamp: Date.now(),
                  });
                }
                shouldYield = true;
              }
              break;

            case "TOOL_CALL_ARGS":
              if ("toolCallId" in event && "delta" in event) {
                const toolCallId = event.toolCallId as string;
                const delta = event.delta as string;
                const toolCall = toolCalls.get(toolCallId);
                if (toolCall) {
                  toolCall.args += delta;
                  shouldYield = true;
                }
              }
              break;

            case "TOOL_CALL_END":
              if ("toolCallId" in event) {
                const toolCallId = event.toolCallId as string;
                const toolCall = toolCalls.get(toolCallId);
                if (toolCall) {
                  toolCall.isComplete = true;

                  // Intercept client-side tools — execute locally and store result
                  if (registry.isRegistered(toolCall.name)) {
                    try {
                      const resultJson = await registry.executeTool(toolCall.name, toolCall.args);
                      toolCall.result = JSON.parse(resultJson);
                    } catch (err) {
                      toolCall.result = {
                        error: err instanceof Error ? err.message : "Client-side tool failed",
                      };
                      toolCall.isError = true;
                    }
                    if (import.meta.env.DEV) {
                      useDevStore.getState().updateToolCall(toolCallId, {
                        args: toolCall.args,
                        result: toolCall.result,
                      });
                    }
                  } else if (import.meta.env.DEV) {
                    // Server-side tool — capture args (result comes via TOOL_CALL_RESULT)
                    useDevStore.getState().updateToolCall(toolCallId, {
                      args: toolCall.args,
                    });
                  }

                  shouldYield = true;
                }
              }
              break;

            case "TOOL_CALL_RESULT":
              if ("toolCallId" in event && "content" in event) {
                const toolCallId = event.toolCallId as string;
                const content = event.content as string;
                const toolCall = toolCalls.get(toolCallId);
                if (toolCall) {
                  try {
                    const parsed = JSON.parse(content);
                    toolCall.result = parsed;
                    if (parsed && typeof parsed === "object" && "error" in parsed) {
                      toolCall.isError = true;
                    }
                  } catch {
                    toolCall.result = content;
                  }
                  if (import.meta.env.DEV) {
                    useDevStore.getState().updateToolCall(toolCallId, {
                      result: toolCall.result,
                    });
                  }
                  shouldYield = true;
                }
              }
              break;

            case "STATE_SNAPSHOT":
            case "STATE_DELTA":
            case "MESSAGES_SNAPSHOT":
            case "ACTIVITY_SNAPSHOT":
            case "ACTIVITY_DELTA":
              break;
          }

          if (shouldYield) {
            const result = buildYield();
            if (result.content && result.content.length > 0) {
              yield result;
            }
          }
        }

        // After stream ends, check if client-side tools need a follow-up request
        const pendingClientTools = Array.from(toolCalls.values()).filter(
          (tc) => registry.isRegistered(tc.name) && tc.result !== undefined && !tc.followedUp,
        );

        if (pendingClientTools.length === 0) break;

        // Mark as followed up to prevent infinite loops
        for (const tc of pendingClientTools) {
          tc.followedUp = true;
        }

        // Build follow-up messages: assistant tool calls + tool results
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: currentText || "",
          toolCalls: pendingClientTools.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args },
          })),
        };

        const toolResultMsgs = pendingClientTools.map((tc) => ({
          id: crypto.randomUUID(),
          role: "tool",
          toolCallId: tc.id,
          content: JSON.stringify(tc.result),
        }));

        currentMessages = [...currentMessages, assistantMsg, ...toolResultMsgs];
        currentText = "";
      }
    } finally {
      setStreaming({ status: "idle" });
    }
  }

  get threadId(): string {
    return this.httpAgent.threadId;
  }

  get state(): unknown {
    return this.httpAgent.state;
  }

  get messages(): unknown[] {
    return this.httpAgent.messages;
  }
}
