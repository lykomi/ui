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

  it("survives being sent, because the rows are still selected", () => {
    // Ephemeral one-shot context goes with the message. A live selection is
    // not one-shot: the rows are still ticked, the effect that published them
    // will not re-run (nothing changed), and dropping the chip would quietly
    // take them out of every later message.
    const store = useAppStore.getState();
    store.setContextItem("list:risks", note("2 risks selected"));
    store.addContextItem(note("a one-shot mention"));
    store.consumeContextForMessage("m1");
    expect(useAppStore.getState().contextItems.map((i) => i.label)).toEqual(["2 risks selected"]);
    store.setContextItem("list:risks", null);
    expect(useAppStore.getState().contextItems).toEqual([]);
  });

  it("navigation still takes it away, however it was published", () => {
    // Keyed context tracks a piece of UI. When the page holding that UI is
    // gone, so is the context — even if the caller marked it persistent, or a
    // list on an unrelated page would keep feeding the agent rows nobody can
    // see. A pin the user made survives, because promoting drops the key.
    const store = useAppStore.getState();
    store.setContextItem("list:risks", note("2 risks selected"));
    store.setContextItem("list:tasks", { ...note("1 task"), persistence: "persistent" });
    store.addContextItem({ ...note("a real pin"), persistence: "persistent" });
    store.setCurrentPage("/somewhere-else");
    expect(useAppStore.getState().contextItems.map((i) => i.label)).toEqual(["a real pin"]);
  });

  it("pinning hands the item to the user, so the next selection cannot take it", () => {
    const store = useAppStore.getState();
    store.setContextItem("list:risks", note("2 risks selected"));
    const pinned = useAppStore.getState().contextItems[0]!;
    store.promoteContextItem(pinned.id);
    expect(useAppStore.getState().contextItems[0]!.key).toBeUndefined();
    store.setContextItem("list:risks", null);
    expect(useAppStore.getState().contextItems.map((i) => i.persistence)).toEqual(["persistent"]);
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
