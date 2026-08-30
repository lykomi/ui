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

  it('treats "" as a key, because someone chose it', () => {
    const store = useAppStore.getState();
    store.setContextItem("", { ...note("keyed with an empty string"), persistence: "persistent" });
    store.setCurrentPage("/elsewhere");
    expect(useAppStore.getState().contextItems).toEqual([]);
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

  it("re-setting an identical item does nothing, even one carrying a bigint", () => {
    // The guard exists to stop a UI that mirrors a selection into context from
    // minting a fresh id and array on every render and driving itself into an
    // update loop. A bigint is not exotic where these payloads come from — the
    // Neo4j driver returns them natively — and comparing with a bare
    // `JSON.stringify` THROWS on one, so "not equal" on the throw would have
    // re-opened the loop for exactly the data most likely to hit it.
    const store = useAppStore.getState();
    const withBigint = () => ({
      ...note("Metropolis"),
      payload: { kind: "text" as const, text: "Metropolis", views: 10n } as never,
    });

    store.setContextItem("graph.selection", withBigint());
    const first = useAppStore.getState().contextItems;
    store.setContextItem("graph.selection", withBigint());

    expect(useAppStore.getState().contextItems).toBe(first);
  });

  it("does not mistake a changed bigint for the string of its digits", () => {
    // The comparison has to be lossless in BOTH directions. Rendering a bigint
    // as its own digits made `10n` and `"10"` the same signature, so a real
    // edit read as "no change" and the context the agent answers from kept the
    // old value while the UI showed the new one.
    const store = useAppStore.getState();
    const item = (views: unknown) => ({
      ...note("Metropolis"),
      payload: { kind: "text" as const, text: "Metropolis", views } as never,
    });

    store.setContextItem("graph.selection", item(10n));
    const first = useAppStore.getState().contextItems;
    store.setContextItem("graph.selection", item("10"));

    expect(useAppStore.getState().contextItems).not.toBe(first);
  });

  it("notices a changed value that carries no enumerable keys", () => {
    // A `Date` keeps its state internally, so comparing key sets said two
    // different instants were the same value — and this guard decides whether
    // the context attached to later messages is stale.
    const store = useAppStore.getState();
    const item = (at: unknown) => ({
      ...note("Metropolis"),
      payload: { kind: "text" as const, text: "Metropolis", at } as never,
    });

    store.setContextItem("graph.selection", item(new Date(1)));
    const first = useAppStore.getState().contextItems;
    store.setContextItem("graph.selection", item(new Date(1)));
    expect(useAppStore.getState().contextItems).toBe(first);

    store.setContextItem("graph.selection", item(new Date(2)));
    expect(useAppStore.getState().contextItems).not.toBe(first);
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
