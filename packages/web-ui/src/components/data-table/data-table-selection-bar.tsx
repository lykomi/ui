/**
 * What you can do with the rows you ticked. Appears only while something is
 * selected, states the count in words, and hosts drop their bulk actions in —
 * the same place in every list, so "select some rows, then do a thing" is one
 * habit across the platform (and the same set the chat agent reads).
 */
import type { Row, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";

/**
 * Whether the bar has a row to itself or shares one.
 *
 * The toolbar's non-stacked layout puts the bar on the SAME line as the
 * search, in a region that scrolls sideways rather than growing — because a
 * toolbar that gains height on the first tick shoves the table down under
 * the cursor mid-click, which is the whole reason the bar moved into the
 * toolbar. A bar that wraps internally defeats that just as thoroughly as
 * one that wraps externally, and its nested actions container is a second
 * place it can happen (review catch).
 *
 * The container knows the constraint and the bar owns the class names, so
 * the policy travels between them instead of the toolbar reaching in with a
 * descendant selector — which would apply to a host's own `selectionBar`
 * node too, and lose to it on specificity besides.
 */
const SelectionBarSingleLineContext = createContext(false);

export const SelectionBarSingleLine = SelectionBarSingleLineContext.Provider;

export interface DataTableSelectionBarProps<T> {
  table: Table<T>;
  /** Bulk actions for the selected rows. */
  children?: ReactNode | ((rows: Row<T>[]) => ReactNode);
  /** What one row is called ("risk"); the plural is derived, or give `plural`. */
  label?: string;
  plural?: string;
  className?: string;
}

export function DataTableSelectionBar<T>({
  table,
  children,
  label = "row",
  plural,
  className,
}: DataTableSelectionBarProps<T>) {
  // Every selected row, not only the ones the current filter shows: a
  // selection the user cannot see is still a selection, and hiding the bar
  // would take away the only way to clear it.
  const rows = table.getSelectedRowModel().rows;
  const singleLine = useContext(SelectionBarSingleLineContext);
  if (rows.length === 0) return null;
  return (
    <div
      data-selection-bar=""
      role="status"
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-xl bg-primary/5 px-3 text-sm",
        singleLine ? "flex-nowrap whitespace-nowrap" : "flex-wrap",
        className,
      )}
    >
      <span className="font-medium">
        {rows.length} {rows.length === 1 ? label : (plural ?? `${label}s`)} selected
      </span>
      <div
        data-selection-actions=""
        className={cn("flex items-center gap-2", singleLine ? "flex-nowrap" : "flex-wrap")}
      >
        {typeof children === "function" ? children(rows) : children}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // `true` = the blank state, not the caller's `initialState`, which
        // would make "Clear" resurrect rows.
        onClick={() => table.resetRowSelection(true)}
        className="ml-auto h-8 rounded-lg px-2.5"
      >
        Clear
        <X className="size-4" />
      </Button>
    </div>
  );
}
