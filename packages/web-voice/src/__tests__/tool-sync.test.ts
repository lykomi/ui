import { describe, expect, it, vi } from "vitest";
import type { ToolRegistry } from "@lykomi/agent";
import { ToolSync } from "../adapter/tool-sync.ts";

function registry(names: string[]): ToolRegistry {
  const schemas = names.map((name) => ({ name, description: "", parameters: {} }));
  return {
    isRegistered: (n) => names.includes(n),
    executeTool: async () => "{}",
    getActiveSchemas: () => schemas as ReturnType<ToolRegistry["getActiveSchemas"]>,
  };
}

describe("ToolSync", () => {
  it("sends the current catalogue", () => {
    const send = vi.fn();
    new ToolSync(send).sync(registry(["ui_navigate"]), undefined);
    expect(send).toHaveBeenCalledWith([
      { type: "function", name: "ui_navigate", description: "", parameters: {} },
    ]);
  });

  it("says nothing when the catalogue has not changed", () => {
    // `clientToolRegistry` is a zustand store: subscribers fire on ANY write,
    // not only tool changes. Without this, every unrelated mutation puts a
    // session.update on a live socket.
    const send = vi.fn();
    const sync = new ToolSync(send);
    sync.sync(registry(["ui_navigate"]), undefined);
    sync.sync(registry(["ui_navigate"]), undefined);
    sync.sync(registry(["ui_navigate"]), undefined);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends again when the catalogue actually changes", () => {
    const send = vi.fn();
    const sync = new ToolSync(send);
    sync.sync(registry(["ui_navigate"]), undefined);
    sync.sync(registry(["ui_navigate", "page_open"]), undefined);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toHaveLength(2);
  });

  it("re-sends an unchanged catalogue after a reset — the reconnect case", () => {
    // A new session carries its own session.update, so what the previous one
    // sent proves nothing. Treating the first sync of a new session as a
    // duplicate would leave it running on a catalogue nobody sent.
    const send = vi.fn();
    const sync = new ToolSync(send);
    sync.sync(registry(["ui_navigate"]), undefined);
    sync.reset();
    sync.sync(registry(["ui_navigate"]), undefined);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("delivers a change that happened before the session was ready", () => {
    // The regression Copilot caught: the old guard dropped a registry change
    // that arrived while connecting, and nothing replayed it. The caller now
    // syncs on the ready edge — from this object's side, that is simply the
    // first sync, and it must carry the CURRENT tools, not the ones present
    // when the session was created.
    const send = vi.fn();
    const sync = new ToolSync(send);
    // (nothing sent while connecting — the caller does not call sync yet)
    expect(send).not.toHaveBeenCalled();
    // ready edge: page has since navigated and swapped its page tools
    sync.sync(registry(["ui_navigate", "page_contract"]), undefined);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].map((t) => t.name)).toEqual(["ui_navigate", "page_contract"]);
  });

  it("keeps the host's MCP tools in every synchronised catalogue", () => {
    // The regression this exists for: `session.update` REPLACES the tool
    // catalogue. Sending only the registry's half withdrew every server-side
    // tool the host configured the instant the session became ready — and the
    // ready-edge sync added for the previous finding made that certain rather
    // than merely possible. The sync has to rebuild the same merged list the
    // session was built with.
    const send = vi.fn();
    const mcp = { type: "mcp", serverLabel: "corpus", serverUrl: "https://example.invalid/mcp" };
    new ToolSync(send).sync(registry(["ui_navigate"]), [mcp] as never);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual([
      { type: "function", name: "ui_navigate", description: "", parameters: {} },
      mcp,
    ]);
  });

  it("re-sends when only the host's tools changed", () => {
    const send = vi.fn();
    const sync = new ToolSync(send);
    const reg = registry(["ui_navigate"]);
    sync.sync(reg, undefined);
    sync.sync(reg, [
      { type: "mcp", serverLabel: "corpus", serverUrl: "https://example.invalid/mcp" },
    ] as never);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toHaveLength(2);
  });
});
