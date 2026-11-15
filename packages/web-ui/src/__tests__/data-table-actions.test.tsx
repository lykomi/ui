import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useDataTable } from "../components/data-table/use-data-table.ts";
import {
  useDataTableActions,
  type DataTableAction,
} from "../components/data-table/use-data-table-actions.ts";

type Item = { id: string };
let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useDataTableActions<Item>>;
function mount(actions: DataTableAction<Item>[], rows = [{ id: "one" }, { id: "two" }]) {
  function Harness() {
    const table = useDataTable({ data: rows, columns: [], getRowId: (row) => row.id });
    current = useDataTableActions({ table, actions });
    return null;
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
}
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

it("executes registered actions only for known loaded rows", async () => {
  const execute = vi.fn();
  mount([{ id: "complete", label: "Complete", execute }]);
  let result;
  await act(async () => {
    result = await current.run("complete", ["one", "one"]);
  });
  expect(result).toEqual({ status: "complete", rowIds: ["one"] });
  expect(execute).toHaveBeenCalledWith([{ id: "one" }]);
  await act(async () => {
    result = await current.run("complete", ["missing"]);
  });
  expect(result).toMatchObject({ status: "error" });
  expect(execute).toHaveBeenCalledTimes(1);
});

it("waits for confirmation, rechecks availability and rejects concurrent actions", async () => {
  const execute = vi.fn();
  let allowed = true;
  mount([
    { id: "delete", label: "Delete", destructive: true, isAvailable: () => allowed, execute },
  ]);
  let result!: ReturnType<typeof current.run>;
  act(() => {
    result = current.run("delete", ["one"]);
  });
  expect(current.confirmation.open).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  await act(async () => {
    expect(await current.run("delete", ["two"])).toMatchObject({ status: "error" });
  });
  allowed = false;
  await act(async () => {
    current.confirmation.onConfirm();
    expect(await result).toMatchObject({ status: "error" });
  });
  expect(execute).not.toHaveBeenCalled();
});

it("runs the same action from a row menu after human confirmation", async () => {
  const execute = vi.fn();
  mount([{ id: "delete", label: "Delete", destructive: true, execute }]);
  act(() => current.forRows(["two"])[0].onSelect());
  await act(async () => {
    current.confirmation.onConfirm();
  });
  expect(execute).toHaveBeenCalledWith([{ id: "two" }]);
});

it("cancels on dialog dismissal or unmount without executing", async () => {
  const execute = vi.fn();
  mount([{ id: "delete", label: "Delete", destructive: true, execute }]);
  let result!: ReturnType<typeof current.run>;
  act(() => {
    result = current.run("delete", ["one"]);
  });
  await act(async () => {
    current.confirmation.onOpenChange(false);
    expect(await result).toEqual({ status: "cancelled" });
  });
  act(() => {
    result = current.run("delete", ["two"]);
  });
  await act(async () => {
    root.unmount();
    expect(await result).toEqual({ status: "cancelled" });
  });
  expect(execute).not.toHaveBeenCalled();
});
