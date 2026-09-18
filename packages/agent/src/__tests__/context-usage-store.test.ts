import { beforeEach, describe, expect, it } from "vitest";

import { contextUsageStore } from "../store/context-usage-store.ts";

beforeEach(() => contextUsageStore.setState({ windowTokens: null, byThread: {} }));

describe("contextUsageStore", () => {
  it("records the latest usage per thread", () => {
    contextUsageStore.getState().record("t1", { inputTokens: 10 });
    contextUsageStore.getState().record("t1", { inputTokens: 20, outputTokens: 5 });
    contextUsageStore.getState().record("t2", { inputTokens: 7 });

    const { byThread } = contextUsageStore.getState();
    expect(byThread.t1).toMatchObject({ inputTokens: 20, outputTokens: 5 });
    expect(byThread.t2).toMatchObject({
      inputTokens: 7,
      outputTokens: null,
      contextUsed: null,
      contextLimit: null,
    });
  });

  it("forgets a deleted thread, and everything on teardown", () => {
    contextUsageStore.getState().record("t1", { inputTokens: 10 });
    contextUsageStore.getState().record("t2", { inputTokens: 20 });

    contextUsageStore.getState().forget("t1");
    expect(Object.keys(contextUsageStore.getState().byThread)).toEqual(["t2"]);

    contextUsageStore.getState().clear();
    expect(contextUsageStore.getState().byThread).toEqual({});
  });

  it("accepts only a positive finite window", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      contextUsageStore.getState().setWindow(bad);
      expect(contextUsageStore.getState().windowTokens).toBeNull();
    }
    contextUsageStore.getState().setWindow(128_000);
    expect(contextUsageStore.getState().windowTokens).toBe(128_000);
  });
});
