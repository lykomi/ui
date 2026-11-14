import { expect, it } from "vitest";
import { summarizeChatContext } from "../chat-context-summary.ts";
import type { AgentStateProjection } from "../app-store.ts";
function state(): AgentStateProjection {
  return {
    navigation: {
      group: null,
      groupDescription: null,
      groupMeta: {},
      page: "/document",
      label: "Briefing",
      description: null,
      meta: {},
      contextInstructions: null,
    },
    selectedItemId: null,
    content: {},
    highlights: [],
    contextItems: [],
  };
}
it("describes navigation without treating it as a workspace boundary", () => {
  const projection = state();
  expect(summarizeChatContext(projection)).toMatchObject({
    label: "Briefing",
    detail: "",
    focused: false,
  });
  projection.navigation.label = "Chat";
  expect(summarizeChatContext(projection).label).toBe("this conversation");
});
it("reads the active field and caret from module-supplied references", () => {
  const projection = state();
  projection.contextItems = [
    { type: "ref", payload: { meta: { fieldFocus: "visible", fieldLabel: "Name" } } },
    {
      type: "ref",
      payload: {
        meta: { fieldFocus: "active", fieldLabel: "Notes", caret: { selectedText: "Revise this" } },
      },
    },
  ];
  expect(summarizeChatContext(projection)).toMatchObject({
    detail: "Notes",
    field: true,
    selectedText: "Revise this",
  });
});
it("shows the focused table and explicitly selected passage from the request projection", () => {
  const projection = state();
  projection.navigation.meta.focusedSurface = { title: "Price reconciliation" };
  projection.contextItems = [
    { type: "selection", text: "Budget" },
    { type: "ref", label: "Contract", meta: { windowState: "open" } },
  ];
  expect(summarizeChatContext(projection)).toMatchObject({
    label: "Price reconciliation",
    focused: true,
    detail: "Selected text",
    selectedText: "Budget",
    references: ["Contract"],
  });
});

it("shows the selected dashboard component from the same agent projection", () => {
  const projection = state();
  projection.contextItems = [
    {
      type: "ref",
      payload: {
        meta: {
          componentFocus: "active",
          componentLabel: "Items by status",
        },
      },
    },
  ];
  expect(summarizeChatContext(projection)).toMatchObject({
    label: "Briefing",
    detail: "Items by status",
  });
});

it("does not repeat the focused field title", () => {
  const projection = state();
  projection.navigation.meta.focusedSurface = { title: "Instructions" };
  projection.contextItems = [
    {
      type: "ref",
      payload: {
        meta: {
          fieldFocus: "active",
          fieldLabel: "Instructions",
        },
      },
    },
  ];
  expect(summarizeChatContext(projection)).toMatchObject({ label: "Instructions", detail: "" });
});

it("shows the visible active item and drops it when closed or hidden", () => {
  const projection = state();
  projection.navigation.label = "Activity";
  projection.contextItems = [
    {
      type: "ref",
      label: "Review renewal options",
      meta: { windowState: "active", visible: true },
    },
  ];
  expect(summarizeChatContext(projection)).toMatchObject({
    label: "Activity",
    detail: "Review renewal options",
  });
  projection.contextItems[0].meta = { windowState: "active", visible: false };
  expect(summarizeChatContext(projection).detail).toBe("");
  projection.contextItems = [];
  expect(summarizeChatContext(projection).detail).toBe("");
});
