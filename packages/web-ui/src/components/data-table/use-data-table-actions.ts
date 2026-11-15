import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { Table } from "@tanstack/react-table";
import type { DataTableRowAction } from "./data-table-row-actions.tsx";

/** Register once per list; row menus, selection controls and agent tools share execution. */
export interface DataTableAction<T> {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  destructive?: boolean;
  /** Called again after confirmation. Server-side authorization still belongs to the host. */
  isAvailable?: (rows: readonly T[]) => boolean;
  execute: (rows: readonly T[]) => void | Promise<void>;
}

export type DataTableActionResult =
  | { status: "complete"; rowIds: string[] }
  | { status: "cancelled" }
  | { status: "error"; error: string };

export function useDataTableActions<T>({
  table,
  actions,
  itemLabel = "row",
}: {
  table: Table<T>;
  actions: readonly DataTableAction<T>[];
  itemLabel?: string;
}) {
  const latest = useRef({ table, actions });
  latest.current = { table, actions };
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<{ label: string; count: number } | null>(null);
  const resolveConfirmation = useRef<((value: boolean) => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resolveConfirmation.current?.(false);
      resolveConfirmation.current = null;
    };
  }, []);
  const confirm = useCallback((value: boolean) => {
    const resolve = resolveConfirmation.current;
    resolveConfirmation.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);
  const resolveRows = (ids: string[]) => {
    const byId = latest.current.table.getCoreRowModel().rowsById;
    return ids.flatMap((id) =>
      Object.prototype.hasOwnProperty.call(byId, id) ? [byId[id].original] : [],
    );
  };
  const resolver = useRef(resolveRows);
  resolver.current = resolveRows;

  const run = useCallback(
    async (actionId: string, rowIds: string[]): Promise<DataTableActionResult> => {
      const fail = (message: string): DataTableActionResult => {
        if (mounted.current) setError(message);
        return { status: "error", error: message };
      };
      if (!mounted.current) return { status: "cancelled" };
      if (busy.current) return fail("Another list action is already in progress.");
      const ids = [...new Set(rowIds)];
      const action = latest.current.actions.find((entry) => entry.id === actionId);
      const rows = resolver.current(ids);
      if (
        !action ||
        !ids.length ||
        rows.length !== ids.length ||
        action.isAvailable?.(rows) === false
      )
        return fail("This action is not available for these loaded rows.");
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        if (action.destructive) {
          const accepted = await new Promise<boolean>((resolve) => {
            resolveConfirmation.current = resolve;
            setRequest({ label: action.label, count: rows.length });
          });
          if (!accepted || !mounted.current) return { status: "cancelled" };
        }
        // Never run stale callbacks/permissions after a person has reviewed a dialog.
        const current = latest.current.actions.find((entry) => entry.id === actionId);
        const currentRows = resolver.current(ids);
        if (
          !current ||
          currentRows.length !== ids.length ||
          current.isAvailable?.(currentRows) === false ||
          (current.destructive && !action.destructive)
        )
          return fail("The available rows or action changed. Please try again.");
        await current.execute(currentRows);
        return { status: "complete", rowIds: ids };
      } catch (cause) {
        return fail(
          cause instanceof Error ? cause.message : "The action failed. Please try again.",
        );
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [],
  );

  const forRows = (rowIds: string[]): DataTableRowAction[] => {
    const rows = resolveRows(rowIds);
    return actions.map((action) => ({
      label: action.label,
      icon: action.icon,
      destructive: action.destructive,
      disabled:
        pending ||
        !rows.length ||
        rows.length !== rowIds.length ||
        action.isAvailable?.(rows) === false,
      onSelect: () => {
        void run(action.id, rowIds);
      },
    }));
  };

  return {
    run,
    forRows,
    pending,
    error,
    /** Spread onto the shared ConfirmDialog, mounted once beside the list. */
    confirmation: {
      open: request !== null,
      title: request
        ? `${request.label} ${request.count} ${itemLabel}${request.count === 1 ? "" : "s"}?`
        : "Confirm action",
      description:
        "This changes the selected items. Continue only if these are the items you intend to change.",
      confirmLabel: request?.label ?? "Confirm",
      destructive: true,
      onConfirm: () => confirm(true),
      onOpenChange: (open: boolean) => {
        if (!open) confirm(false);
      },
    },
  };
}
