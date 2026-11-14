import { afterEach, expect, it } from "vitest";
import { agentStateStore, contextUsageStore } from "@lykomi/agent";
import {
  disposeChatRuns,
  publishChatAgentState,
  selectChatRun,
  removeChatRun,
} from "../chat-runs-store.ts";

afterEach(() => {
  disposeChatRuns();
  agentStateStore.getState().reset();
});

it("restores state received by a background conversation without leaking it into another", () => {
  selectChatRun("first");
  publishChatAgentState("first", { value: 1 });
  selectChatRun("second");
  publishChatAgentState("second", { value: 2 });
  publishChatAgentState("first", { value: 3 }, [{ op: "replace", path: "/value", value: 3 }]);
  expect(agentStateStore.getState().state).toEqual({ value: 2 });
  selectChatRun("first");
  expect(agentStateStore.getState().state).toEqual({ value: 3 });
  expect(agentStateStore.getState().lastPatch).toHaveLength(1);
  selectChatRun("fresh");
  expect(agentStateStore.getState().state).toBeNull();
});

it("clears a deleted foreground projection but preserves another conversation's state", () => {
  selectChatRun("a");
  publishChatAgentState("a", { value: "a" });
  publishChatAgentState("b", { value: "b" });
  removeChatRun("b");
  expect(agentStateStore.getState().state).toEqual({ value: "a" });
  removeChatRun("a");
  expect(agentStateStore.getState().state).toBeNull();
  publishChatAgentState("a", { value: "late" });
  expect(agentStateStore.getState().state).toBeNull();
});

it("forgets a deleted conversation's memory fill, and all of it on teardown", () => {
  contextUsageStore.getState().record("gone", { inputTokens: 90_000 });
  contextUsageStore.getState().record("kept", { inputTokens: 10 });
  removeChatRun("gone");
  expect(Object.keys(contextUsageStore.getState().byThread)).toEqual(["kept"]);
  disposeChatRuns();
  expect(contextUsageStore.getState().byThread).toEqual({});
});
