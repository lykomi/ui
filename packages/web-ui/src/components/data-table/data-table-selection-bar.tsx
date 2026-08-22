/**
 * What you can do with the rows you ticked. Appears only while something is
 * selected, states the count in words, and hosts drop their bulk actions in —
 * the same place in every list, so "select some rows, then do a thing" is one
 * habit across the platform (and the same set the chat agent reads).
 */
import type { Row, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";

export interface DataTableSelectionBarProps<T> {
  table: Table<T>;
  /** Bulk actions for the selected rows. */
  children?: ReactNode | ((rows: Row<T>[]) => ReactNode);
  /** What the rows are called, for the count ("3 risks selected"). */
  label?: string;
  className?: string;
}

export function DataTableSelectionBar<T>({
  table,
  children,
  label = "rows",
  className,
}: DataTableSelectionBarProps<T>) {
  const rows = table.getFilteredSelectedRowModel().rows;
  if (rows.length === 0) return null;
  return (
    <div
      data-selection-bar=""
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="font-medium">
        {rows.length} {label} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {typeof children === "function" ? children(rows) : children}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => table.resetRowSelection()}
        className="ml-auto h-8 rounded-lg px-2.5"
      >
        Clear
        <X className="size-4" />
      </Button>
    </div>
  );
}
