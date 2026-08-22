/**
 * The grid. Renders whatever a `useDataTable` instance says: header groups,
 * flat rows, or group header rows with their expanded children. Row clicks
 * ignore interactive descendants so a selection checkbox or a row menu
 * never doubles as "open".
 */
import { flexRender, type Row, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { DataTableBreakpoint } from "./facets.ts";
import { useDataTableFrame } from "./data-table-frame.tsx";
import { usePinnedOffsets } from "./use-pinned-offsets.ts";
import { useElementWidth } from "./use-element-width.ts";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface DataTableProps<T> {
  table: Table<T>;
  onRowClick?: (row: Row<T>, event: MouseEvent | KeyboardEvent) => void;
  /** The row whose details are open elsewhere (drawer, panel) — highlighted, `aria-current`. */
  activeRowId?: string | null;
  /**
   * Move the active row with ↑/↓ (Home/End for the ends) and clear it with
   * Escape, scrolling it into view — the keyboard flow people expect from a
   * master list beside a detail pane. Needs `activeRowId`.
   */
  onActiveRowChange?: (row: Row<T> | null) => void;
  rowClassName?: (row: Row<T>) => string | undefined;
  /** Content of a group header row (default: label and count). */
  renderGroup?: (row: Row<T>) => ReactNode;
  /** Declared order of group keys; unknown keys follow in data order. */
  groupOrder?: string[];
  emptyState?: ReactNode;
  /** Keep the header in place while the rows scroll (always on in focus mode). */
  stickyHeader?: boolean;
  /**
   * Make the table the scroll region of its flex-column parent, on both
   * axes, instead of growing the page. Defaults to true inside a focused
   * `DataTableFrame`.
   */
  fill?: boolean;
  dense?: boolean;
  className?: string;
  "aria-label"?: string;
}

const INTERACTIVE = "a, button, input, select, textarea, [role='menuitem'], [data-no-row-click]";

/**
 * How wide the list must be for a column to earn its place. Measured on the
 * table itself, not the window: a list beside an open detail pane is narrower
 * than the page, and focus mode is wider — only the table knows.
 */
const MIN_WIDTH: Record<DataTableBreakpoint, number> = {
  sm: 448,
  md: 672,
  lg: 896,
  xl: 1024,
  "2xl": 1280,
};

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
  onActiveRowChange,
  rowClassName,
  renderGroup,
  groupOrder,
  emptyState = "No results.",
  stickyHeader = false,
  fill,
  dense = false,
  className,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const frame = useDataTableFrame();
  // In focus mode the layer is a fixed flex column: the table takes the
  // remaining height (`min-h-0` lets a flex item shrink below its content)
  // and scrolls in both directions, so the toolbar above stays put.
  const filling = fill ?? frame?.focused ?? false;
  const sticky = stickyHeader || filling;
  const rows = orderedRows(table, groupOrder);
  const dataRows = rows.filter((row) => !row.getIsGrouped());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const width = useElementWidth(rootRef);
  const fits = (breakpoint?: DataTableBreakpoint) =>
    !breakpoint || width === undefined || width >= MIN_WIDTH[breakpoint];
  // Pinned columns: frozen against the left edge so a row keeps its identity
  // while the rest of a wide table scrolls sideways.
  const pinnedIds = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.meta?.pinned === "left")
    .map((column) => column.id);
  const { offsets, lastPinned, measure } = usePinnedOffsets(pinnedIds);
  const pinnedStyle = (columnId: string) =>
    offsets[columnId] === undefined ? undefined : { left: offsets[columnId] };
  const pinnedClass = (columnId: string, tone: "header" | "cell") =>
    offsets[columnId] === undefined
      ? undefined
      : cn(
          "sticky z-20",
          tone === "header" ? "bg-card" : "bg-background",
          columnId === lastPinned && "border-r border-border/45",
        );

  // Keyboard: the active row moves with the arrows and stays in view, so a
  // long list can be walked without touching the mouse.
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const moveActive = useCallback(
    (delta: number | "first" | "last") => {
      if (!onActiveRowChange || dataRows.length === 0) return;
      const index = dataRows.findIndex((row) => row.id === activeRowId);
      const next =
        delta === "first"
          ? 0
          : delta === "last"
            ? dataRows.length - 1
            : index < 0
              ? delta > 0
                ? 0
                : dataRows.length - 1
              : Math.min(dataRows.length - 1, Math.max(0, index + delta));
      const row = dataRows[next];
      if (row) onActiveRowChange(row);
    },
    [activeRowId, dataRows, onActiveRowChange],
  );
  useEffect(() => {
    if (!activeRowId) return;
    const element = Array.from(bodyRef.current?.querySelectorAll("tr[data-row-id]") ?? []).find(
      (row) => (row as HTMLElement).dataset.rowId === activeRowId,
    ) as HTMLElement | undefined;
    element?.scrollIntoView?.({ block: "nearest" });
  }, [activeRowId]);
  const columnCount = table
    .getVisibleLeafColumns()
    .filter((column) => fits(column.columnDef.meta?.breakpoint)).length;
  const cellPad = dense ? "px-3 py-1.5" : "px-3 py-2.5";

  const activate = (row: Row<T>, event: MouseEvent | KeyboardEvent) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    onRowClick(row, event);
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "overflow-hidden rounded-2xl border border-border/45 bg-card/60",
        filling && "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <div className={cn(filling ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto")}>
        <table
          className="w-full caption-bottom text-sm"
          aria-label={ariaLabel}
          onKeyDown={
            onActiveRowChange
              ? (event) => {
                  if ((event.target as HTMLElement).closest("input, select, textarea")) return;
                  if (event.key === "ArrowDown") moveActive(1);
                  else if (event.key === "ArrowUp") moveActive(-1);
                  else if (event.key === "Home") moveActive("first");
                  else if (event.key === "End") moveActive("last");
                  else if (event.key === "Escape") onActiveRowChange(null);
                  else return;
                  event.preventDefault();
                }
              : undefined
          }
        >
          <thead className={cn(sticky && "sticky top-0 z-10 bg-card")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/45">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  if (!fits(meta?.breakpoint)) return null;
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      scope="col"
                      ref={meta?.pinned === "left" ? measure(header.column.id) : undefined}
                      style={{
                        ...(header.getSize() !== 150 ? { width: header.getSize() } : {}),
                        ...pinnedStyle(header.column.id),
                      }}
                      className={cn(
                        "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        pinnedClass(header.column.id, "header"),
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
          <tbody ref={bodyRef}>
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
                      if (!fits(meta?.breakpoint)) return null;
                      return (
                        <td
                          key={cell.id}
                          style={pinnedStyle(cell.column.id)}
                          className={cn(
                            cellPad,
                            "align-middle",
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center",
                            pinnedClass(cell.column.id, "cell"),
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
