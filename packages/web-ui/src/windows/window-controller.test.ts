import { expect, it, vi } from "vitest";
import { createWindowStore, type WorkbenchWindow } from "./window-controller.ts";

function setup() {
  const windows = createWindowStore();
  const tab = (id: string, options: Partial<WorkbenchWindow> = {}): WorkbenchWindow => ({
    id,
    title: id,
    close: () => windows.remove(id),
    ...options,
  });
  return { windows, tab };
}

it("replaces clean previews but protects pinned, independent and dirty windows", () => {
  const { windows, tab } = setup();
  windows.open(tab("preview"));
  windows.open(tab("replacement"));
  expect(windows.get().tabs.map((t) => t.id)).toEqual(["replacement"]);
  windows.keep("replacement");
  windows.open(tab("draft", { dirty: true }));
  windows.open(tab("independent", { independent: true }), { mode: "new-tab" });
  windows.open(tab("next"));
  expect(windows.get().tabs.map((t) => t.id)).toEqual([
    "replacement",
    "draft",
    "independent",
    "next",
  ]);
});

it("preserves content and order across layout changes and clamps widths", () => {
  const { windows, tab } = setup();
  const first = tab("a", { dirty: true });
  windows.open(first);
  windows.open(tab("b"), { mode: "new-tab" });
  windows.setLayout("panels");
  expect(windows.get().tabs[0]).toBe(first);
  windows.move("b", 0);
  windows.resize("a", 3000);
  windows.resize("a", NaN);
  windows.setLayout("tabs");
  expect(windows.get().tabs.map((t) => t.id)).toEqual(["b", "a"]);
  expect(windows.get().active).toBe("b");
  expect(windows.get().tabs[1]?.panelWidth).toBe(2400);
  windows.resize("a");
  expect(windows.get().tabs[1]?.panelWidth).toBeUndefined();
});

it("selects the right neighbour then the left when closing an active window", () => {
  const { windows, tab } = setup();
  ["a", "b", "c"].forEach((id) => windows.open(tab(id), { mode: "new-tab" }));
  windows.select("b");
  windows.remove("b");
  expect(windows.get().active).toBe("c");
  windows.remove("c");
  expect(windows.get().active).toBe("a");
  windows.remove("a");
  expect(windows.get().active).toBe("");
});

it("an old asynchronous leave decision cannot override a newer selection", async () => {
  const pending: ((allowed: boolean) => void)[] = [];
  const windows = createWindowStore({
    tabs: ["a", "b", "c"].map((id) => ({ id, title: id, close: vi.fn() })),
    beforeLeave: () => new Promise<boolean>((resolve) => pending.push(resolve)),
  });
  const first = windows.select("b");
  const second = windows.select("c");
  pending[1]!(true);
  expect(await second).toBe(true);
  pending[0]!(true);
  expect(await first).toBe(false);
  expect(windows.get().active).toBe("c");
});

it("denial, abort and failed leave guards preserve the current window", async () => {
  const guard = vi.fn().mockResolvedValue(false);
  const windows = createWindowStore({
    tabs: [{ id: "a", title: "a", close: vi.fn() }],
    beforeLeave: guard,
  });
  const close = vi.fn();
  expect(await windows.open({ id: "b", title: "b", close })).toBe(false);
  expect(close).not.toHaveBeenCalled();
  const abort = new AbortController();
  abort.abort();
  expect(await windows.select("b", { signal: abort.signal })).toBe(false);
  guard.mockRejectedValueOnce(new Error("Cannot save"));
  expect(await windows.select("b")).toBe(false);
  expect(windows.get().active).toBe("a");
});

it("keeps stores independent and tolerates unavailable browser storage", () => {
  const { windows, tab } = setup();
  const other = createWindowStore();
  windows.open(tab("a"));
  expect(other.get().tabs).toEqual([]);
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    const persisted = createWindowStore({ storageKey: "test.windows" });
    persisted.setLayout("panels", { remember: true });
    expect(persisted.get().layout).toBe("panels");
  } finally {
    spy.mockRestore();
  }
});

it("a stale open never closes a newer window with the same id or its draft", async () => {
  const pending: ((allowed: boolean) => void)[] = [];
  const windows = createWindowStore({
    beforeLeave: () => new Promise<boolean>((resolve) => pending.push(resolve)),
  });
  const close = vi.fn(() => windows.remove("b"));
  const first = windows.open({ id: "b", title: "old", close });
  const second = windows.open({ id: "b", title: "new", close });
  pending[1]!(true);
  expect(await second).toBe(true);
  windows.update("b", { title: "edited draft", dirty: true });
  pending[0]!(true);
  expect(await first).toBe(false);
  expect(close).not.toHaveBeenCalled();
  expect(windows.get().tabs).toMatchObject([{ id: "b", title: "edited draft", dirty: true }]);
});

it("cancels a selection if its destination closes while the leave decision is pending", async () => {
  const pending: ((allowed: boolean) => void)[] = [];
  const windows = createWindowStore({
    tabs: ["a", "b", "c"].map((id) => ({ id, title: id, close: vi.fn() })),
    beforeLeave: () => new Promise<boolean>((resolve) => pending.push(resolve)),
  });
  const selection = windows.select("b");
  windows.remove("b");
  pending[0]!(true);
  expect(await selection).toBe(false);
  expect(windows.get().active).toBe("a");
  const next = windows.select("c");
  windows.remove("missing");
  pending[1]!(true);
  expect(await next).toBe(true);
  expect(windows.get().active).toBe("c");
});

it("removing a pending open cancels it without calling a committed window's close callback", async () => {
  let decide!: (allowed: boolean) => void;
  const windows = createWindowStore({
    beforeLeave: () =>
      new Promise<boolean>((resolve) => {
        decide = resolve;
      }),
  });
  const close = vi.fn();
  const opening = windows.open({ id: "b", title: "b", close });
  windows.remove("b");
  decide(true);
  expect(await opening).toBe(false);
  expect(windows.get().tabs).toEqual([]);
  expect(close).not.toHaveBeenCalled();
});
