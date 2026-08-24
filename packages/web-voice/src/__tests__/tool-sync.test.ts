import { describe, expect, it, vi } from "vitest";
import type { ToolRegistry } from "@iloveagents/foundry-agent";
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
    new ToolSync(send).sync(registry(["ui_navigate"]));
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
    sync.sync(registry(["ui_navigate"]));
    sync.sync(registry(["ui_navigate"]));
    sync.sync(registry(["ui_navigate"]));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends again when the catalogue actually changes", () => {
    const send = vi.fn();
    const sync = new ToolSync(send);
    sync.sync(registry(["ui_navigate"]));
    sync.sync(registry(["ui_navigate", "page_open"]));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toHaveLength(2);
  });

  it("re-sends an unchanged catalogue after a reset — the reconnect case", () => {
    // A new session carries its own session.update, so what the previous one
    // sent proves nothing. Treating the first sync of a new session as a
    // duplicate would leave it running on a catalogue nobody sent.
    const send = vi.fn();
    const sync = new ToolSync(send);
    sync.sync(registry(["ui_navigate"]));
    sync.reset();
    sync.sync(registry(["ui_navigate"]));
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
    sync.sync(registry(["ui_navigate", "page_contract"]));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].map((t) => t.name)).toEqual(["ui_navigate", "page_contract"]);
  });
});
