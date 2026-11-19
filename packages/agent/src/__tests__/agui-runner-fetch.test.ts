import { afterEach, expect, it, vi } from "vitest";
import { AGUIRunner } from "../client/agui-runner.ts";

afterEach(() => vi.unstubAllGlobals());

it.each(["default", "native override", "custom"])(
  "streams through the real HttpAgent with fetch=%s",
  async (mode) => {
    const request = vi.fn(async function (
      this: unknown,
      _url: RequestInfo | URL,
      init?: RequestInit,
    ) {
      // Browser fetch rejects a foreign receiver; Node's implementation does not.
      if (mode !== "custom" && this !== undefined && this !== globalThis)
        throw new TypeError("Illegal invocation");
      const input = JSON.parse(String(init?.body));
      return new Response(
        [
          { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
          { type: "TEXT_MESSAGE_START", messageId: "answer", role: "assistant" },
          { type: "TEXT_MESSAGE_CONTENT", messageId: "answer", delta: "hello" },
          { type: "TEXT_MESSAGE_END", messageId: "answer" },
          { type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    vi.stubGlobal(
      "fetch",
      mode === "custom"
        ? vi.fn(() => {
            throw new Error("Custom fetch was bypassed");
          })
        : request,
    );
    const runner = new AGUIRunner({
      url: "https://agent.example/api/agent",
      threadId: "thread",
      ...(mode !== "default" ? { fetchFn: request } : {}),
    });
    const events = [];
    for await (const event of runner.run({
      messages: [{ id: "user", role: "user", content: "hello" }],
      registry: {
        isRegistered: () => false,
        executeTool: async () => "",
        getActiveSchemas: () => [],
      },
    }))
      events.push(event);
    expect(request).toHaveBeenCalledOnce();
    expect(events).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "hello" }));
  },
);
