/**
 * Tests for usePageContext — tests the underlying store operations
 * since the hook is a thin mount/unmount wrapper over addContextItem/removeContextItem.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../app-store";

const reset = () =>
  useAppStore.setState({
    contextItems: [],
    sentContext: {},
  });

const store = () => useAppStore.getState();

const noteItem = () => ({
  type: "note" as const,
  label: "Dashboard metrics",
  payload: { kind: "text" as const, text: "Q1 revenue data" },
  sourcePage: "/dashboard",
  persistence: "ephemeral" as const,
});

describe("usePageContext (store operations)", () => {
  beforeEach(reset);

  it("addContextItem adds note items", () => {
    store().addContextItem(noteItem());
    expect(store().contextItems).toHaveLength(1);
    expect(store().contextItems[0].label).toBe("Dashboard metrics");
    expect(store().contextItems[0].type).toBe("note");
  });

  it("removeContextItem removes by id (simulates unmount cleanup)", () => {
    store().addContextItem(noteItem());
    const id = store().contextItems[0].id;

    store().removeContextItem(id);
    expect(store().contextItems).toHaveLength(0);
  });

  it("re-adding after removal works (simulates remount)", () => {
    store().addContextItem(noteItem());
    const id = store().contextItems[0].id;
    store().removeContextItem(id);

    store().addContextItem(noteItem());
    expect(store().contextItems).toHaveLength(1);
  });

  it("ephemeral note items are cleared on navigation", () => {
    store().addContextItem(noteItem());
    expect(store().contextItems).toHaveLength(1);

    store().setCurrentPage("/other-page");
    expect(store().contextItems).toHaveLength(0);
  });
});
