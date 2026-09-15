import { afterEach, expect, it } from "vitest";
import { agentStateStore } from "@iloveagents/foundry-agent";
import { disposeChatRuns, publishChatAgentState, selectChatRun } from "../chat-runs-store.ts";

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
