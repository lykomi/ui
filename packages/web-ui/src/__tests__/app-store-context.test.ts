/**
 * Context that tracks the UI — the rows selected in a list — is one item per
 * key: setting it again replaces, and clearing takes it away. Without that, a
 * chip whose label changes with the selection piles up and the assistant is
 * told about rows nobody has selected any more.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../lib/app-store.ts";

const note = (label: string) => ({
  type: "note" as const,
  label,
  payload: { kind: "text" as const, text: label },
  sourcePage: "/list",
  persistence: "ephemeral" as const,
});

describe("keyed context items", () => {
  beforeEach(() => useAppStore.setState({ contextItems: [] }));

  it("replaces by key instead of piling up, and clears on null", () => {
    const store = useAppStore.getState();
    store.setContextItem("list:risks", note("2 risks selected"));
    store.setContextItem("list:risks", note("3 risks selected"));
    expect(useAppStore.getState().contextItems.map((i) => i.label)).toEqual(["3 risks selected"]);
    store.setContextItem("list:risks", null);
    expect(useAppStore.getState().contextItems).toEqual([]);
  });

  it("leaves other keys and the user's own pins alone", () => {
    const store = useAppStore.getState();
    store.addContextItem(note("a note the user pinned"));
    store.setContextItem("list:risks", note("2 risks selected"));
    store.setContextItem("list:tasks", note("1 task selected"));
    store.setContextItem("list:risks", null);
    expect(useAppStore.getState().contextItems.map((i) => i.label)).toEqual([
      "a note the user pinned",
      "1 task selected",
    ]);
  });
});
