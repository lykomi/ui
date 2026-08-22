/**
 * The grid. Renders whatever a `useDataTable` instance says: header groups,
 * flat rows, or group header rows with their expanded children. Row clicks
 * ignore interactive descendants so a selection checkbox or a row menu
 * never doubles as "open".
 */
import { flexRender, type Header, type Row, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DATA_TABLE_MIN_WIDTH, type DataTableBreakpoint } from "./facets.ts";
import { useDataTableFrame } from "./data-table-frame.tsx";
import { usePinnedOffsets } from "./use-pinned-offsets.ts";
import { useElementWidth } from "./use-element-width.ts";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface DataTableProps<T> {
  table: Table<T>;
  /** Single click on a row — selecting it, in the desktop sense. */
  onRowClick?: (row: Row<T>, event: MouseEvent | KeyboardEvent) => void;
  /**
   * Opening a row: Enter or a double click, the way a file list behaves. Keep
   * it separate from `onRowClick` so brushing or clicking a row (to scroll,
   * to select) never opens a detail pane by surprise.
   */
  onRowOpen?: (row: Row<T>, event: MouseEvent | KeyboardEvent) => void;
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
  /**
   * Keep the columns at their natural width and let the leftover room sit at
   * the end, the way a spreadsheet looks, instead of stretching a text column
   * across the gap. Set `false` for a table whose last column should fill.
   */
  spacer?: boolean;
  /** Keep the header in place while the rows scroll (always on in focus mode). */
  stickyHeader?: boolean;
  /**
   * Make the table the scroll region of its flex-column parent, on both
   * axes, instead of growing the page. Defaults to true inside a focused
   * `DataTableFrame`.
   */
  fill?: boolean;
  /**
   * Give the list its own viewport of at most this height (e.g. `"70vh"`),
   * so the rows scroll under a sticky header instead of running down the
   * page — the way a spreadsheet-like list is expected to behave. Ignored
   * while `fill` is on, which already bounds the height.
   */
  maxHeight?: string | number;
  dense?: boolean;
  /**
   * The columns the table actually drew, whenever that set changes. Width and
   * focus gating happen at render time and are deliberately NOT TanStack
   * visibility (that belongs to the user and rides in the URL) — so anything
   * that must agree with what is on screen, above all the chat agent's view
   * of the list, learns it here.
   */
  onRenderedColumnsChange?: (columnIds: string[]) => void;
  className?: string;
  "aria-label"?: string;
}

const INTERACTIVE = "a, button, input, select, textarea, [role='menuitem'], [data-no-row-click]";

/** Group header rows and their expanded children, in declared group order. */
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
  onRowOpen,
  activeRowId,
  onActiveRowChange,
  rowClassName,
  renderGroup,
  groupOrder,
  emptyState = "No results.",
  spacer = true,
  stickyHeader = false,
  fill,
  maxHeight,
  dense = false,
  onRenderedColumnsChange,
  className,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const frame = useDataTableFrame();
  // In focus mode the layer is a fixed flex column: the table takes the
  // remaining height (`min-h-0` lets a flex item shrink below its content)
  // and scrolls in both directions, so the toolbar above stays put.
  const filling = fill ?? frame?.focused ?? false;
  const bounded = !filling && maxHeight !== undefined;
  // A header only sticks inside a scroll container — which is exactly what
  // `fill` and `maxHeight` create.
  const sticky = stickyHeader || filling || bounded;
  const rows = orderedRows(table, groupOrder);
  const dataRows = rows.filter((row) => !row.getIsGrouped());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrolledX, setScrolledX] = useState(false);
  const width = useElementWidth(rootRef);
  // A column has to earn its place twice: the mode it is meant for, and the
  // width the list actually has.
  const fits = (meta?: { breakpoint?: DataTableBreakpoint; showIn?: "always" | "focus" }) => {
    // Focus mode is the question, not `fill`: `fill` is a scroll-layout prop
    // a host may set on an ordinary page, and it would otherwise reveal
    // columns meant for the fullscreen layer (and hide them inside it when
    // a host passed `fill={false}`).
    if (meta?.showIn === "focus" && !(frame?.focused ?? false)) return false;
    const breakpoint = meta?.breakpoint;
    return !breakpoint || width === undefined || width >= DATA_TABLE_MIN_WIDTH[breakpoint];
  };
  // What the table actually draws: TanStack visibility, then the width and
  // mode gates. Everything downstream — the pinned run, the empty-row colspan,
  // what the host is told — is derived from this one list, so none of them can
  // name a column that is not on screen.
  const renderedColumns = table
    .getVisibleLeafColumns()
    .filter((column) => fits(column.columnDef.meta));
  const fittingLeafCount = (header: Header<T, unknown>): number =>
    header.subHeaders.length === 0
      ? fits(header.column.columnDef.meta)
        ? 1
        : 0
      : header.subHeaders.reduce((total, sub) => total + fittingLeafCount(sub), 0);
  // Pinned columns: frozen against the left edge so a row keeps its identity
  // while the rest of a wide table scrolls sideways.
  // Freezing is a run from the left edge: everything up to the last pinned
  // column comes along, so a leading checkbox never slides out from under the
  // rows it belongs to. A pinned column the width gate dropped is not in the
  // run at all — otherwise the seam would mark a column nobody can see.
  const lastPinnedIndex = renderedColumns.reduce(
    (last, column, index) => (column.columnDef.meta?.pinned === "left" ? index : last),
    -1,
  );
  const pinnedIds = renderedColumns.slice(0, lastPinnedIndex + 1).map((column) => column.id);
  const { offsets, lastPinned, measure } = usePinnedOffsets(pinnedIds);
  // A pinned cell is opaque — the other columns slide underneath it — and it
  // restates the row's hover / selected / active tints. Those rules live in
  // this package's `styles.css`, keyed off the attributes below, so a host
  // needs no CSS wiring of its own.
  const pinnedProps = (columnId: string, tone: "header" | "cell") =>
    offsets[columnId] === undefined
      ? {}
      : {
          "data-pinned": tone,
          "data-pinned-edge": columnId === lastPinned ? "" : undefined,
        };
  const pinnedStyle = (columnId: string) =>
    offsets[columnId] === undefined ? undefined : { left: offsets[columnId] };

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
  // Sorting, filtering or a late-arriving page moves the active row without
  // changing its id, and an id restored before the rows load points at nothing
  // yet — so the position is part of what this watches.
  const activeIndex = dataRows.findIndex((row) => row.id === activeRowId);
  useEffect(() => {
    if (!activeRowId || activeIndex < 0) return;
    const element = Array.from(bodyRef.current?.querySelectorAll("tr[data-row-id]") ?? []).find(
      (row) => (row as HTMLElement).dataset.rowId === activeRowId,
    ) as HTMLElement | undefined;
    element?.scrollIntoView?.({ block: "nearest" });
    // Take the keyboard along, but only if it was already in the list:
    // arrows move the active row, and leaving focus on the row it left means
    // the next Enter opens the wrong one. Focus is never stolen from
    // elsewhere on the page.
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (element && active && active !== element && bodyRef.current?.contains(active)) {
      element.focus?.({ preventScroll: true });
    }
  }, [activeRowId, activeIndex]);
  const columnCount = renderedColumns.length + (spacer ? 1 : 0);
  const renderedKey = renderedColumns.map((column) => column.id).join(",");
  const renderedRef = useRef(onRenderedColumnsChange);
  renderedRef.current = onRenderedColumnsChange;
  useEffect(() => {
    renderedRef.current?.(renderedKey ? renderedKey.split(",") : []);
  }, [renderedKey]);
  const cellPad = dense ? "px-3 py-1.5" : "px-3 py-2.5";

  const activate = (
    row: Row<T>,
    event: MouseEvent | KeyboardEvent,
    handler: DataTableProps<T>["onRowClick"],
  ) => {
    if (!handler) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    handler(row, event);
  };

  return (
    <div
      ref={rootRef}
      // The frozen seam is a signal that content is hidden to the left, so it
      // only shows once the list is actually scrolled sideways.
      data-scrolled-x={scrolledX ? "" : undefined}
      className={cn(
        "overflow-hidden rounded-2xl border border-border/45 bg-card/60",
        filling && "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <div
        ref={scrollerRef}
        onScroll={(event) => {
          const next = event.currentTarget.scrollLeft > 0;
          setScrolledX((current) => (current === next ? current : next));
        }}
        data-list-scroller=""
        style={bounded ? { maxHeight } : undefined}
        className={cn(
          filling ? "min-h-0 flex-1 overflow-auto" : bounded ? "overflow-auto" : "overflow-x-auto",
        )}
      >
        <table
          className="w-full caption-bottom text-sm"
          aria-label={ariaLabel}
          onKeyDown={
            onActiveRowChange
              ? (event) => {
                  // Let a control that owns these keys keep them.
                  if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                  if (event.key === "ArrowDown") moveActive(1);
                  else if (event.key === "ArrowUp") moveActive(-1);
                  else if (event.key === "Home") moveActive("first");
                  else if (event.key === "End") moveActive("last");
                  else if (event.key === "Escape") {
                    // One Escape, one effect: without this the frame's own
                    // document listener also fires and the list leaves
                    // focus mode while the user only wanted the row let go.
                    onActiveRowChange(null);
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                  } else return;
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
                  // A grouping header spans its leaves; when the width gate
                  // drops some of them it has to narrow, and when it drops all
                  // of them the group header goes too.
                  const span = fittingLeafCount(header);
                  if (span === 0) return null;
                  return (
                    <th
                      key={header.id}
                      colSpan={span}
                      scope="col"
                      // Every column in the run, not only the marked ones: the
                      // run can start with an unmarked leader (a selection
                      // checkbox), and an unmeasured leader leaves the column
                      // after it stacked at zero, overlapping it.
                      ref={
                        pinnedIds.includes(header.column.id) ? measure(header.column.id) : undefined
                      }
                      {...pinnedProps(header.column.id, "header")}
                      style={{
                        ...(header.getSize() !== 150 ? { width: header.getSize() } : {}),
                        ...pinnedStyle(header.column.id),
                      }}
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
                {spacer ? <th aria-hidden="true" className="w-full p-0" /> : null}
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
                    <td colSpan={columnCount} className="p-0">
                      {/* The group's cell spans the whole (scrollable) width,
                          so its content is pinned to the viewport instead —
                          the label and total stay put while the columns move. */}
                      <div
                        data-group-content=""
                        style={width ? { width } : undefined}
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
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
                    data-clickable={onRowClick || onRowOpen ? "" : undefined}
                    tabIndex={onRowClick || onRowOpen || onActiveRowChange ? 0 : undefined}
                    // `detail` counts the clicks in the sequence: the second
                    // one belongs to the double-click that follows, and
                    // letting it through would toggle a selection off again
                    // right before the row opens.
                    onClick={(event) => {
                      if (event.detail > 1) return;
                      activate(row, event, onRowClick);
                    }}
                    onDoubleClick={(event) => activate(row, event, onRowOpen)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                        event.preventDefault();
                        activate(row, event, onRowOpen ?? onRowClick);
                      } else if (event.key === " ") {
                        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                        event.preventDefault();
                        activate(row, event, onRowClick);
                      }
                    }}
                    className={cn(
                      "group/row border-t border-border/35 transition-colors",
                      (onRowClick || onRowOpen) &&
                        "cursor-pointer hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none",
                      "data-[state=selected]:bg-primary/6 data-[active]:bg-primary/8",
                      rowClassName?.(row),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      if (!fits(meta)) return null;
                      return (
                        <td
                          key={cell.id}
                          {...pinnedProps(cell.column.id, "cell")}
                          style={pinnedStyle(cell.column.id)}
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
                    {spacer ? <td aria-hidden="true" className="w-full p-0" /> : null}
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
