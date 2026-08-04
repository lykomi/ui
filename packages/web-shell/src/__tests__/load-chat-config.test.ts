import { beforeEach, describe, expect, it, vi } from "vitest";

const setResolved = vi.fn();

vi.mock("@iloveagents/foundry-agent", () => ({
  reasoningDefaultStore: { getState: () => ({ setResolved }) },
}));

import { _setChatConfigFetch, loadChatConfig, refreshChatConfig } from "../load-chat-config.ts";

function fetchReturning(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  setResolved.mockClear();
  // reset the module-level boot fetch between tests
  _setChatConfigFetch(undefined as unknown as typeof fetch);
});

describe("loadChatConfig", () => {
  it("passes opaque params as a query string", async () => {
    const fetchImpl = fetchReturning({ reasoning: { defaultEffort: "medium" } });
    await loadChatConfig(fetchImpl, { entityId: "e-1" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/chat/config?entityId=e-1");
  });

  it("omits the query entirely without params", async () => {
    const fetchImpl = fetchReturning({ reasoning: { defaultEffort: "medium" } });
    await loadChatConfig(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("/api/chat/config");
  });

  it("forwards the scope with the resolved level", async () => {
    const fetchImpl = fetchReturning({
      reasoning: { defaultEffort: "high", scope: "for this workspace" },
    });
    await loadChatConfig(fetchImpl);
    expect(setResolved).toHaveBeenCalledWith("high", "for this workspace");
  });

  it("drops a missing or non-string scope to null", async () => {
    await loadChatConfig(fetchReturning({ reasoning: { defaultEffort: "medium" } }));
    expect(setResolved).toHaveBeenLastCalledWith("medium", null);

    await loadChatConfig(
      fetchReturning({ reasoning: { defaultEffort: "medium", scope: { odd: 1 } } }),
    );
    expect(setResolved).toHaveBeenLastCalledWith("medium", null);
  });

  it("resets on an unknown level — a wrong level is worse than none", async () => {
    await loadChatConfig(
      fetchReturning({ reasoning: { defaultEffort: "turbo", scope: "x" } }),
    );
    expect(setResolved).toHaveBeenLastCalledWith(null);
  });

  it("resets on a non-OK response", async () => {
    await loadChatConfig(fetchReturning({}, false));
    expect(setResolved).toHaveBeenLastCalledWith(null);
  });
});

describe("refreshChatConfig", () => {
  it("is a safe no-op before the shell boots", async () => {
    await expect(refreshChatConfig({ entityId: "e-2" })).resolves.toBeUndefined();
    expect(setResolved).not.toHaveBeenCalled();
  });

  it("uses the boot fetch once wired", async () => {
    const fetchImpl = fetchReturning({
      reasoning: { defaultEffort: "high", scope: "for this workspace" },
    });
    _setChatConfigFetch(fetchImpl);
    await refreshChatConfig({ entityId: "e-3" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/chat/config?entityId=e-3");
    expect(setResolved).toHaveBeenCalledWith("high", "for this workspace");
  });
});
