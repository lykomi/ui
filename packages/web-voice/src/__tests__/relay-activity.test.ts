import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import { currentRelayActivity } from "../adapter/relay-activity.ts";

const user = { role: "user", content: [] } as unknown as ThreadMessage;
const assistant = (content: unknown[]) =>
  ({ role: "assistant", content }) as unknown as ThreadMessage;
const tool = (name: string, result?: unknown) => ({
  type: "tool-call",
  toolName: name,
  args: { type: "workspace" },
  result,
});

describe("current relay activity", () => {
  it("never describes tools from an earlier user turn", () => {
    expect(currentRelayActivity([user, assistant([tool("old_search", {})]), user])).toBeNull();
    expect(currentRelayActivity([assistant([tool("old_search")])])).toBeNull();
  });
  it("prefers a pending parallel call to a later completed call", () => {
    expect(
      currentRelayActivity([user, assistant([tool("search_hybrid"), tool("entities_list", {})])]),
    ).toMatchObject({ toolName: "search_hybrid", completed: false });
  });
  it("reports the latest completed call and its structured arguments", () => {
    expect(
      currentRelayActivity([
        user,
        assistant([tool("search_hybrid", {}), tool("entities_list", null)]),
      ]),
    ).toEqual({ toolName: "entities_list", completed: true, args: { type: "workspace" } });
  });
});
