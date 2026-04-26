import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../app-store";

const reset = () =>
  useAppStore.setState({
    threadActive: false,
    currentPage: "/chat",
    navContext: {
      group: null,
      groupDescription: null,
      groupMeta: {},
      label: "Chat",
      description: null,
      meta: {},
      contextInstructions: null,
    },
    selectedItemId: null,
    content: {},
    highlights: [],
    contextItems: [],
    sentContext: {},
  });
const store = () => useAppStore.getState();

const ephemeralItem = (label = "hello", sourcePage = "panel") => ({
  type: "selection" as const,
  label,
  payload: { kind: "text" as const, text: label },
  sourcePage,
  persistence: "ephemeral" as const,
});

const persistentItem = (label = "pinned", sourcePage = "panel") => ({
  type: "selection" as const,
  label,
  payload: { kind: "text" as const, text: label },
  sourcePage,
  persistence: "persistent" as const,
});

const pageItem = (path = "/workspace", label = "Form") => ({
  type: "page" as const,
  label,
  payload: { kind: "page" as const, path, label },
  sourcePage: path,
  persistence: "persistent" as const,
});

const refItem = (refId = "entity-1:block-1", preview = "Introduction") => ({
  type: "ref" as const,
  label: preview,
  payload: { kind: "ref" as const, refType: "block", refId, preview },
  sourcePage: "/spaces/entity-1",
  persistence: "persistent" as const,
});

describe("app-store", () => {
  beforeEach(reset);

  describe("addContextItem", () => {
    it("adds an item with generated id and createdAt", () => {
      store().addContextItem(ephemeralItem());
      expect(store().contextItems).toHaveLength(1);
      expect(store().contextItems[0]).toMatchObject({
        label: "hello",
        sourcePage: "panel",
        type: "selection",
        persistence: "ephemeral",
      });
      expect(store().contextItems[0].id).toBeTruthy();
      expect(store().contextItems[0].createdAt).toBeGreaterThan(0);
    });

    it("deduplicates by label + sourcePage", () => {
      store().addContextItem(ephemeralItem("same", "src"));
      store().addContextItem(ephemeralItem("same", "src"));
      expect(store().contextItems).toHaveLength(1);
    });

    it("allows same label from different sources", () => {
      store().addContextItem(ephemeralItem("same", "src-a"));
      store().addContextItem(ephemeralItem("same", "src-b"));
      expect(store().contextItems).toHaveLength(2);
    });

    it("caps at 10 items", () => {
      for (let i = 0; i < 11; i++) {
        store().addContextItem(ephemeralItem(`text-${i}`));
      }
      expect(store().contextItems).toHaveLength(10);
    });

    it("deduplicates page items by path", () => {
      store().addContextItem(pageItem("/workspace", "Form"));
      store().addContextItem(pageItem("/workspace", "Form copy"));
      expect(store().contextItems).toHaveLength(1);
    });

    it("allows page items with different paths", () => {
      store().addContextItem(pageItem("/workspace"));
      store().addContextItem(pageItem("/documents"));
      expect(store().contextItems).toHaveLength(2);
    });

    it("deduplicates ref items by refId", () => {
      store().addContextItem(refItem("e1:b1", "Intro"));
      store().addContextItem(refItem("e1:b1", "Intro copy"));
      expect(store().contextItems).toHaveLength(1);
    });

    it("allows ref items with different refIds", () => {
      store().addContextItem(refItem("e1:b1"));
      store().addContextItem(refItem("e1:b2"));
      expect(store().contextItems).toHaveLength(2);
    });

    it("truncates label longer than 500 chars", () => {
      const longLabel = "a".repeat(600);
      store().addContextItem(ephemeralItem(longLabel));
      expect(store().contextItems[0].label).toHaveLength(503);
      expect(store().contextItems[0].label.endsWith("...")).toBe(true);
    });
  });

  describe("removeContextItem", () => {
    it("removes by id, leaves others", () => {
      store().addContextItem(ephemeralItem("a"));
      store().addContextItem(ephemeralItem("b"));
      const idToRemove = store().contextItems[0].id;
      store().removeContextItem(idToRemove);
      expect(store().contextItems).toHaveLength(1);
      expect(store().contextItems[0].label).toBe("b");
    });
  });

  describe("consumeContextForMessage", () => {
    it("keeps persistent items, removes ephemeral", () => {
      store().addContextItem(persistentItem("pinned"));
      store().addContextItem(ephemeralItem("temp"));
      const snapshot = store().consumeContextForMessage("msg-1");

      expect(snapshot).toHaveLength(2);
      expect(store().contextItems).toHaveLength(1);
      expect(store().contextItems[0].label).toBe("pinned");
      expect(store().sentContext["msg-1"]).toHaveLength(2);
    });

    it("returns empty array without side effects when no items", () => {
      const snapshot = store().consumeContextForMessage("msg-1");
      expect(snapshot).toEqual([]);
      expect(store().sentContext).toEqual({});
    });
  });

  describe("clearAllContext", () => {
    it("resets items and sentContext", () => {
      store().addContextItem(ephemeralItem("a"));
      store().consumeContextForMessage("msg-1");
      store().addContextItem(ephemeralItem("b"));
      store().clearAllContext();
      expect(store().contextItems).toHaveLength(0);
      expect(store().sentContext).toEqual({});
    });
  });

  describe("promoteContextItem", () => {
    it("changes ephemeral to persistent", () => {
      store().addContextItem(ephemeralItem("temp"));
      const id = store().contextItems[0].id;
      store().promoteContextItem(id);
      expect(store().contextItems[0].persistence).toBe("persistent");
    });
  });

  describe("navContext", () => {
    it("setNavContext updates navigation context", () => {
      store().setNavContext({
        group: "Contracts",
        groupDescription: "Contract workspace",
        groupMeta: { orgId: "org-1" },
        label: "Acme NDA",
        description: "Review NDA terms",
        meta: { contractId: "123" },
        contextInstructions: null,
      });
      expect(store().navContext.group).toBe("Contracts");
      expect(store().navContext.groupMeta).toEqual({ orgId: "org-1" });
      expect(store().navContext.label).toBe("Acme NDA");
      expect(store().navContext.meta).toEqual({ contractId: "123" });
    });
  });

  describe("setCurrentPage", () => {
    it("clears ephemeral context on navigation", () => {
      store().addContextItem(ephemeralItem("temp"));
      store().addContextItem(persistentItem("pinned"));
      store().setCurrentPage("/workspace");
      expect(store().contextItems).toHaveLength(1);
      expect(store().contextItems[0].label).toBe("pinned");
    });

    it("does not clear when navigating to the same page", () => {
      store().addContextItem(ephemeralItem("temp"));
      store().setCurrentPage("/chat"); // same as default
      expect(store().contextItems).toHaveLength(1);
    });
  });

  describe("content", () => {
    it("updates individual fields", () => {
      store().updateContentField("title", "My Draft");
      store().updateContentField("priority", "high");
      expect(store().content).toEqual({ title: "My Draft", priority: "high" });
    });

    it("clearContent resets to empty", () => {
      store().updateContentField("title", "test");
      store().clearContent();
      expect(store().content).toEqual({});
    });
  });

  describe("highlights", () => {
    it("adds and removes highlights", () => {
      store().addHighlight("field-1");
      store().addHighlight("field-2");
      expect(store().highlights).toEqual(["field-1", "field-2"]);

      store().removeHighlight("field-1");
      expect(store().highlights).toEqual(["field-2"]);
    });

    it("deduplicates highlights", () => {
      store().addHighlight("field-1");
      store().addHighlight("field-1");
      expect(store().highlights).toHaveLength(1);
    });
  });

  describe("getAgentState", () => {
    it("returns correct projection with navigation context", () => {
      store().setCurrentPage("/workspace");
      store().setNavContext({
        group: "Pages",
        groupDescription: null,
        groupMeta: {},
        label: "Workspace",
        description: "Collaborate on drafts",
        meta: {},
        contextInstructions: null,
      });
      store().setSelectedItemId("doc-1");
      store().updateContentField("title", "Test");
      store().addHighlight("field-1");
      store().addContextItem(persistentItem("ctx"));

      const projection = store().getAgentState();
      expect(projection).toEqual({
        navigation: {
          group: "Pages",
          groupDescription: null,
          groupMeta: {},
          page: "/workspace",
          label: "Workspace",
          description: "Collaborate on drafts",
          meta: {},
          contextInstructions: null,
        },
        selectedItemId: "doc-1",
        content: { title: "Test" },
        highlights: ["field-1"],
        contextItems: [
          {
            type: "selection",
            label: "ctx",
            text: "ctx",
            sourcePage: "panel",
          },
        ],
      });
    });

    it("includes navigation metadata", () => {
      store().setNavContext({
        group: "Contracts",
        groupDescription: "Contract workspace",
        groupMeta: { orgId: "org-1" },
        label: "Acme NDA",
        description: "Review NDA",
        meta: { contractId: "123", type: "nda" },
        contextInstructions: null,
      });
      store().setCurrentPage("/contracts/123");

      const projection = store().getAgentState();
      expect(projection.navigation.meta).toEqual({ contractId: "123", type: "nda" });
      expect(projection.navigation.groupMeta).toEqual({ orgId: "org-1" });
      expect(projection.navigation.group).toBe("Contracts");
    });
  });

  describe("resetAll", () => {
    it("resets all state to defaults", () => {
      store().markThreadActive();
      store().setNavContext({
        group: "Contracts",
        groupDescription: "test",
        groupMeta: { orgId: "1" },
        label: "Acme",
        description: "test",
        meta: { id: "1" },
        contextInstructions: null,
      });
      store().setSelectedItemId("doc-1");
      store().updateContentField("title", "test");
      store().addHighlight("field-1");
      store().addContextItem(ephemeralItem("temp"));

      store().resetAll();

      expect(store().threadActive).toBe(false);
      expect(store().navContext.group).toBeNull();
      expect(store().navContext.label).toBe("Chat");
      expect(store().selectedItemId).toBeNull();
      expect(store().content).toEqual({});
      expect(store().highlights).toEqual([]);
      expect(store().contextItems).toEqual([]);
    });
  });
});
