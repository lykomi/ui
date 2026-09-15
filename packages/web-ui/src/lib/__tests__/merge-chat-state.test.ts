import { expect, it } from "vitest";
import { mergeChatState } from "../merge-chat-state.ts";

it("retains background server updates while applying current page and selection changes", () => {
  const previous = { content: { draft: "old", selected: "a" }, navigation: { page: "/a" } };
  const server = {
    ...previous,
    content: { draft: "server revision", selected: "a" },
    progress: 42,
  };
  const current = { content: { draft: "old", selected: "b" }, navigation: { page: "/b" } };
  expect(mergeChatState(server, previous, current)).toEqual({
    content: { draft: "server revision", selected: "b" },
    navigation: { page: "/b" },
    progress: 42,
  });
});
it("removes context cleared by the user", () => {
  expect(
    mergeChatState(
      { content: { chosen: "a", progress: 1 } },
      { content: { chosen: "a" } },
      { content: {} },
    ),
  ).toEqual({ content: { progress: 1 } });
});
