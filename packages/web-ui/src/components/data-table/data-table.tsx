/**
 * The grid. Renders whatever a `useDataTable` instance says: header groups,
 * flat rows, or group header rows with their expanded children. Row clicks
 * ignore interactive descendants so a selection checkbox or a row menu
 * never doubles as "open".
 */
import { flexRender, type Row, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface DataTableProps<T> {
  table: Table<T>;
  onRowClick?: (row: Row<T>, event: MouseEvent | KeyboardEvent) => void;
  /** The row whose details are open elsewhere (drawer, panel) — highlighted, `aria-current`. */
  activeRowId?: string | null;
  rowClassName?: (row: Row<T>) => string | undefined;
  /** Content of a group header row (default: label and count). */
  renderGroup?: (row: Row<T>) => ReactNode;
  /** Declared order of group keys; unknown keys follow in data order. */
  groupOrder?: string[];
  emptyState?: ReactNode;
  stickyHeader?: boolean;
  dense?: boolean;
  className?: string;
  "aria-label"?: string;
}

const INTERACTIVE = "a, button, input, select, textarea, [role='menuitem'], [data-no-row-click]";

function orderedRows<T>(table: Table<T>, groupOrder?: string[]): Row<T>[] {
  const rows = table.getRowModel().rows;
  if (!table.getState().grouping.length) return rows;
  const top = rows.filter((row) => row.depth === 0);
  const rank = new Map((groupOrder ?? []).map((key, index) => [key, index]));
  const sorted = groupOrder
    ? [...top].sort((a, b) => {
        const ra = rank.get(String(a.groupingValue ?? "")) ?? Number.MAX_SAFE_INTEGER;
        const rb = rank.get(String(b.groupingValue ?? "")) ?? Number.MAX_SAFE_INTEGER;
        return ra - rb;
      })
    : top;
  return sorted.flatMap((row) =>
    row.getIsGrouped() && row.getIsExpanded() ? [row, ...row.subRows] : [row],
  );
}

export function DataTable<T>({
  table,
  onRowClick,
  activeRowId,
  rowClassName,
  renderGroup,
  groupOrder,
  emptyState = "No results.",
  stickyHeader = false,
  dense = false,
  className,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const rows = orderedRows(table, groupOrder);
  const columnCount = table.getVisibleLeafColumns().length;
  const cellPad = dense ? "px-3 py-1.5" : "px-3 py-2.5";

  const activate = (row: Row<T>, event: MouseEvent | KeyboardEvent) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    onRowClick(row, event);
  };

  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-border/45 bg-card/60", className)}
    >
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm" aria-label={ariaLabel}>
          <thead className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/45">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      scope="col"
                      style={header.getSize() !== 150 ? { width: header.getSize() } : undefined}
                      className={cn(
                        "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.headerClassName,
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                row.getIsGrouped() ? (
                  <tr
                    key={row.id}
                    data-group-row=""
                    className="border-t border-border/45 bg-muted/35 text-sm font-medium"
                  >
                    <td colSpan={columnCount} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={row.getToggleExpandedHandler()}
                          aria-expanded={row.getIsExpanded()}
                          aria-label={row.getIsExpanded() ? "Collapse group" : "Expand group"}
                          className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {row.getIsExpanded() ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          {renderGroup ? renderGroup(row) : <DefaultGroupLabel row={row} />}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    data-active={activeRowId != null && row.id === activeRowId ? "" : undefined}
                    aria-current={
                      activeRowId != null && row.id === activeRowId ? "true" : undefined
                    }
                    aria-selected={row.getIsSelected() || undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={(event) => activate(row, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                        event.preventDefault();
                        activate(row, event);
                      }
                    }}
                    className={cn(
                      "border-t border-border/35 transition-colors",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none",
                      "data-[state=selected]:bg-primary/6 data-[active]:bg-primary/8",
                      rowClassName?.(row),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            cellPad,
                            "align-middle",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            meta?.className,
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefaultGroupLabel<T>({ row }: { row: Row<T> }) {
  const grouping = row
    .getAllCells()
    .map((cell) => cell.column)
    .find((column) => column.getIsGrouped());
  const key = String(row.groupingValue ?? "");
  const label = grouping ? (grouping.columnDef.meta?.facetLabels?.[key] ?? key) : key;
  return (
    <span>
      {label || "None"}{" "}
      <span className="font-normal text-muted-foreground">({row.subRows.length})</span>
    </span>
  );
}
