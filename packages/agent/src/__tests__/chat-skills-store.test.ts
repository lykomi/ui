import { expect, it } from "vitest";
import { chatSkillsStore } from "../store/chat-skills-store.ts";
it("validates catalogue metadata and preserves first-name precedence", () => {
  chatSkillsStore
    .getState()
    .setSkills([
      { slug: "plan-work", description: "Built in", scope: "platform" },
      { name: "plan-work", description: "Shadow" },
      { name: "../../secret", description: "Invalid" },
      { name: "empty", description: "" },
      null,
    ]);
  expect(chatSkillsStore.getState().skills).toEqual([
    { name: "plan-work", description: "Built in", scope: "platform" },
  ]);
  chatSkillsStore.getState().setSkills(null);
  expect(chatSkillsStore.getState().skills).toEqual([]);
});
