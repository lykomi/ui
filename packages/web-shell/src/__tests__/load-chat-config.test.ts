import { beforeEach, describe, expect, it, vi } from "vitest";

const setResolved = vi.fn();
const setWindow = vi.fn();
const setSkills = vi.fn();

vi.mock("@lykomi/agent", () => ({
  chatSkillsStore: { getState: () => ({ setSkills }) },
  reasoningDefaultStore: { getState: () => ({ setResolved }) },
  contextUsageStore: { getState: () => ({ setWindow }) },
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
  setWindow.mockClear();
  setSkills.mockClear();
  // reset the module-level boot fetch between tests
  _setChatConfigFetch(undefined as unknown as typeof fetch);
});

describe("loadChatConfig", () => {
  it("passes the context window the backend states", async () => {
    // A response with no reasoning level still keeps the window it states.
    await loadChatConfig(fetchReturning({ context: { windowTokens: 128_000 } }));
    expect(setWindow).toHaveBeenLastCalledWith(128_000);
    expect(setResolved).toHaveBeenLastCalledWith(null);
  });

  it("clears the window when the backend states none, or the load fails", async () => {
    await loadChatConfig(fetchReturning({ reasoning: { defaultEffort: "medium" } }));
    expect(setWindow).toHaveBeenLastCalledWith(null);
    setWindow.mockClear();
    await loadChatConfig(fetchReturning({}, false));
    expect(setWindow).toHaveBeenLastCalledWith(null);
  });

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
    await loadChatConfig(fetchReturning({ reasoning: { defaultEffort: "turbo", scope: "x" } }));
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

  it("lets only the latest request write when responses arrive out of order", async () => {
    let releaseSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => (releaseSlow = resolve));
    const slowFetch = vi.fn(async () => {
      await slow;
      return {
        ok: true,
        json: async () => ({
          reasoning: { defaultEffort: "low" },
          context: { windowTokens: 32_000 },
        }),
      };
    }) as unknown as typeof fetch;

    const stale = loadChatConfig(slowFetch, { entity: "old" });
    await loadChatConfig(
      fetchReturning({ reasoning: { defaultEffort: "high" }, context: { windowTokens: 128_000 } }),
      { entity: "current" },
    );
    releaseSlow(undefined);
    await stale;

    expect(setWindow).toHaveBeenLastCalledWith(128_000);
    expect(setResolved).toHaveBeenLastCalledWith("high", null);
  });

  it("does not let a stale failure clear the current values", async () => {
    let releaseSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => (releaseSlow = resolve));
    const failingSlowFetch = vi.fn(async () => {
      await slow;
      throw new Error("network");
    }) as unknown as typeof fetch;

    const stale = loadChatConfig(failingSlowFetch);
    await loadChatConfig(fetchReturning({ context: { windowTokens: 128_000 } }));
    setWindow.mockClear();
    releaseSlow(undefined);
    await stale;

    expect(setWindow).not.toHaveBeenCalled();
  });
});

it("loads the backend skill catalogue and clears it during scope changes", async () => {
  const skills = [{ name: "plan-work", description: "Plan work" }];
  await loadChatConfig(fetchReturning({ skills }));
  expect(setSkills).toHaveBeenLastCalledWith(skills);
  const calls = setSkills.mock.calls.length;
  await loadChatConfig(fetchReturning({}, false), { entityId: "other" });
  expect(setSkills.mock.calls[calls]).toEqual([null]);
  expect(setSkills).toHaveBeenLastCalledWith(null);
});
