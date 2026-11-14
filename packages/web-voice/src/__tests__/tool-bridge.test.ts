import { describe, expect, it, vi } from "vitest";
import type { ToolRegistry } from "@lykomi/agent";
import { createRegistryToolExecutor } from "../adapter/tool-bridge.ts";

function registry(over: Partial<ToolRegistry> = {}): ToolRegistry {
  return {
    isRegistered: () => true,
    executeTool: async () => JSON.stringify({ ok: true }),
    getActiveSchemas: () => [],
    ...over,
  };
}

describe("createRegistryToolExecutor", () => {
  it("dispatches into the registry and returns its result verbatim", async () => {
    const executeTool = vi.fn(async () => JSON.stringify({ navigated: "/contracts" }));
    const run = createRegistryToolExecutor(registry({ executeTool }));

    const result = await run("ui_navigate", '{"path":"/contracts"}', "call_1");

    expect(executeTool).toHaveBeenCalledWith("ui_navigate", '{"path":"/contracts"}');
    expect(result).toBe('{"navigated":"/contracts"}');
  });

  it("answers an unknown tool instead of leaving the call dangling", async () => {
    const run = createRegistryToolExecutor(registry({ isRegistered: () => false }));
    const result = await run("nope", "{}", "call_1");
    expect(JSON.parse(result as string)).toEqual({ error: "Unknown client tool: nope" });
  });

  it("turns a throwing tool into an error result, never a rejection", async () => {
    // An unanswered function call makes the model re-issue the tool and then
    // report that it did not complete — an error result is strictly better.
    const run = createRegistryToolExecutor(
      registry({
        executeTool: async () => {
          throw new Error("panel is closed");
        },
      }),
    );
    await expect(run("ui_open_panel", "{}", "call_1")).resolves.toBe(
      JSON.stringify({ error: "panel is closed" }),
    );
  });

  it("handles a non-Error throw", async () => {
    const run = createRegistryToolExecutor(
      registry({
        executeTool: async () => {
          throw "boom";
        },
      }),
    );
    await expect(run("t", "{}", "c")).resolves.toBe(
      JSON.stringify({ error: "Client-side tool failed" }),
    );
  });
});
