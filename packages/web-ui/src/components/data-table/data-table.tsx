/**
 * The grid. Renders whatever a `useDataTable` instance says: header groups,
 * flat rows, or group header rows with their expanded children. Row clicks
 * ignore interactive descendants so a selection checkbox or a row menu
 * never doubles as "open".
 */
import { flexRender, type Header, type Row, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DATA_TABLE_MIN_WIDTH, type DataTableBreakpoint } from "./facets.ts";
import { useDataTableFrame } from "./data-table-frame.tsx";
import { usePinnedOffsets } from "./use-pinned-offsets.ts";
import { DataTableOverflow } from "./data-table-overflow.tsx";
import { useTableViewport } from "./use-table-viewport.ts";
import { boundedColumnWidth } from "./column-sizing.ts";
import { DataTableColumnResize } from "./data-table-column-resize.tsx";
import { useElementWidth } from "./use-element-width.ts";
import { cn } from "@iloveagents/foundry-web-primitives";

import { useVirtualTableRows } from "./use-virtual-table-rows.js";

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
  /** Conservative cell-control capability. Return false only for rows without tabbable cells.
   * Declare this for readonly or sparse custom cells to avoid probing empty rows. */
  getRowMayHaveTabStops?: (row: Row<T>) => boolean;
  rowClassName?: (row: Row<T>) => string | undefined;
  /** Content of a group header row (default: label and count). */
  renderGroup?: (row: Row<T>) => ReactNode;
  /** Declared order of group keys; unknown keys follow in data order. */
  groupOrder?: string[];
  emptyState?: ReactNode;
  /**
   * Keep the columns at their natural width and let the leftover room sit at
   * the end, the way a spreadsheet looks, instead of stretching a text column
   * across the gap. Set `false` to let the first content column use remaining
   * room, up to its maxSize. An explicitly resized column keeps its width.
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
  /** Keep a bounded viewport and its scroll controls on-screen (default true). */
  fitViewport?: boolean;
  /** Keep paging controls stationary; defaults to true for multiple standard pages. */
  stableHeight?: boolean;
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

// Native controls, the ARIA widgets that own the same keys (a slider or a
// listbox answers to arrows; a checkbox to space), and anything a host marks.
// A row's keyboard handling must never take a key out from under one of them.
const INTERACTIVE = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='option']",
  "[role='tab']",
  // Arrow-owning composites: a tree or a grid inside a cell navigates with
  // exactly the keys this table wants.
  "[role='tree']",
  "[role='treeitem']",
  "[role='grid']",
  "[role='gridcell']",
  "[role='menu']",
  "[role='menubar']",
  "[role='radiogroup']",
  // The plain ones: a div acting as a button or a link is still a control,
  // and its click must not also open the row behind it.
  "[role='button']",
  "[role='link']",
  "[data-no-row-click]",
].join(", ");

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
  activeRowId: controlledActiveRowId,
  onActiveRowChange: controlledOnActiveRowChange,
  rowClassName,
  getRowMayHaveTabStops,
  renderGroup,
  groupOrder,
  emptyState = "No results.",
  spacer = true,
  stickyHeader = false,
  fill,
  maxHeight,
  fitViewport = true,
  stableHeight,
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
  const rowModel = table.getRowModel().rows;
  const { grouping, expanded } = table.getState();
  const rows = useMemo(
    () => orderedRows(table, groupOrder),
    [table, rowModel, grouping, expanded, groupOrder],
  );
  const [localActiveRowId, setLocalActiveRowId] = useState<string | null>(null);
  useEffect(() => setLocalActiveRowId(null), [controlledActiveRowId]);
  const setLocalActiveRow = useCallback(
    (row: Row<T> | null) => setLocalActiveRowId(row?.id ?? null),
    [],
  );
  const internalNavigation =
    !controlledOnActiveRowChange && rows.length > 200 && Boolean(onRowClick || onRowOpen);
  const onActiveRowChange =
    controlledOnActiveRowChange ?? (internalNavigation ? setLocalActiveRow : undefined);
  const activeRowId =
    controlledActiveRowId !== undefined ? controlledActiveRowId : localActiveRowId;
  const navigationRowId = internalNavigation
    ? (localActiveRowId ?? controlledActiveRowId)
    : controlledActiveRowId;
  const effectiveMaxHeight = maxHeight ?? (rows.length > 200 ? "70vh" : undefined);
  const bounded = !filling && effectiveMaxHeight !== undefined;
  // A header only sticks inside a scroll container — which is exactly what
  // `fill` and `maxHeight` create.
  const sticky = stickyHeader || filling || bounded;
  const dataRows = useMemo(() => rows.filter((row) => !row.getIsGrouped()), [rows]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Automatic bounds must contribute height even below the page fold.
  const viewport = useTableViewport(scrollerRef, bounded, fitViewport && maxHeight !== undefined);
  const availableHeight = viewport.height;
  const keepHeight = stableHeight ?? (viewport.paginated && table.getPageCount() > 1);
  const { pageIndex, pageSize } = table.getState().pagination;
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [pageIndex, pageSize]);
  const viewportMaxHeight =
    availableHeight === undefined
      ? effectiveMaxHeight
      : `min(${typeof effectiveMaxHeight === "number" ? `${effectiveMaxHeight}px` : effectiveMaxHeight}, ${availableHeight}px)`;
  const [scrolledX, setScrolledX] = useState(false);
  const width = useElementWidth(rootRef);
  const viewportWidth = useElementWidth(scrollerRef, "client");
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
  // Fixed column tracks keep a long title from choosing the entire table width.
  const sizes = new Map(
    renderedColumns.map((column) => [column.id, boundedColumnWidth(column, column.getSize())]),
  );
  const availableWidth = viewportWidth ?? width ?? 0;
  const first =
    renderedColumns.find((column) => column.accessorFn && column.getCanResize()) ??
    renderedColumns.find((column) => column.id !== "__select" && column.getCanResize());
  const declaredWidth = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  const firstResized =
    first && Object.prototype.hasOwnProperty.call(table.getState().columnSizing, first.id);
  if (!spacer && first && !firstResized && availableWidth > declaredWidth)
    sizes.set(
      first.id,
      boundedColumnWidth(first, first.getSize() + availableWidth - declaredWidth),
    );
  const tableWidth = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  const trailingSpace = spacer || availableWidth > tableWidth;
  const fittingLeafWidth = (header: Header<T, unknown>): number =>
    header.subHeaders.length
      ? header.subHeaders.reduce((sum, child) => sum + fittingLeafWidth(child), 0)
      : (sizes.get(header.column.id) ?? 0);
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
  let lastPinnedIndex = renderedColumns.reduce(
    (last, column, index) => (column.columnDef.meta?.pinned === "left" ? index : last),
    -1,
  );
  // A frozen identity must not cover the entire scrollable pane. Keep the
  // leading utility run when possible; preserve widths and let the rest scroll.
  if (availableWidth > 0 && tableWidth > availableWidth) {
    const limit = Math.max(availableWidth * 0.5, availableWidth - 160);
    while (
      lastPinnedIndex >= 0 &&
      renderedColumns
        .slice(0, lastPinnedIndex + 1)
        .reduce((sum, column) => sum + (sizes.get(column.id) ?? 0), 0) > limit
    )
      do {
        lastPinnedIndex--;
      } while (
        lastPinnedIndex >= 0 &&
        renderedColumns[lastPinnedIndex]?.columnDef.meta?.pinned !== "left" &&
        !(lastPinnedIndex === 0 && renderedColumns[0]?.id === "__select")
      );
  }
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
  const hasCustomCells = useMemo(() => {
    const visit = (definitions: typeof table.options.columns): boolean =>
      definitions.some(
        (definition) =>
          Boolean(definition.cell) || ("columns" in definition && visit(definition.columns ?? [])),
      );
    return Boolean(table.options.defaultColumn?.cell) || visit(table.options.columns);
  }, [table.options.columns, table.options.defaultColumn]);
  const mayHaveTabStops = useCallback(
    (row: Row<T>) =>
      row.getIsGrouped() ||
      Boolean(
        onActiveRowChange &&
        (!internalNavigation || row.id === (navigationRowId ?? dataRows[0]?.id)),
      ) ||
      (getRowMayHaveTabStops ? getRowMayHaveTabStops(row) : hasCustomCells),
    [
      onActiveRowChange,
      internalNavigation,
      navigationRowId,
      dataRows,
      getRowMayHaveTabStops,
      hasCustomCells,
    ],
  );
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const virtual = useVirtualTableRows({
    rows,
    scroller: scrollerRef,
    body: bodyRef,
    bounded: bounded || filling,
    dense,
    activeRowId: navigationRowId,
    mayHaveTabStops,
  });

  const moveActive = useCallback(
    (delta: number | "first" | "last") => {
      if (!onActiveRowChange || dataRows.length === 0) return;
      const index = dataRows.findIndex((row) => row.id === navigationRowId);
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
    [navigationRowId, dataRows, onActiveRowChange],
  );
  // Sorting, filtering or a late-arriving page moves the active row without
  // changing its id, and an id restored before the rows load points at nothing
  // yet — so the position is part of what this watches.
  const activeIndex = useMemo(
    () => (navigationRowId == null ? -1 : dataRows.findIndex((row) => row.id === navigationRowId)),
    [dataRows, navigationRowId],
  );
  useEffect(() => {
    if (!navigationRowId || activeIndex < 0) return;
    const element = Array.from(bodyRef.current?.querySelectorAll("tr[data-row-id]") ?? []).find(
      (row) => (row as HTMLElement).dataset.rowId === navigationRowId,
    ) as HTMLElement | undefined;
    const scroller = scrollerRef.current;
    if (element && scroller) {
      if (scroller.scrollHeight > scroller.clientHeight) {
        const viewport = scroller.getBoundingClientRect();
        const visibleTop = viewport.top + scroller.clientTop;
        const visibleBottom = visibleTop + scroller.clientHeight;
        const rect = element.getBoundingClientRect();
        const headerHeight = sticky
          ? (scroller.querySelector("thead")?.getBoundingClientRect().height ?? 0)
          : 0;
        if (rect.top < visibleTop + headerHeight)
          scroller.scrollTop += rect.top - visibleTop - headerHeight;
        else if (rect.bottom > visibleBottom) scroller.scrollTop += rect.bottom - visibleBottom;
      }
      // The local viewport can itself be clipped by a scrolled host pane.
      // Let the browser reveal through every ancestor, retaining each horizontal
      // position so navigating rows never changes the visible columns.
      const horizontal = new Map<HTMLElement, number>();
      for (let parent: HTMLElement | null = scroller; parent; parent = parent.parentElement) {
        horizontal.set(parent, parent.scrollLeft);
      }
      const windowLeft = window.scrollX;
      element.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
      horizontal.forEach((left, parent) => {
        parent.scrollLeft = left;
      });
      if (window.scrollX !== windowLeft)
        window.scrollTo({ left: windowLeft, top: window.scrollY, behavior: "instant" });
    }
    // Take the keyboard along, but only when it is on a ROW: arrows move the
    // active row, and leaving focus on the row it left means the next Enter
    // opens the wrong one. Focus inside a cell's own control stays there —
    // moving it would eject someone mid-edit when a re-sort happens to shift
    // the row — and focus elsewhere on the page is never stolen.
    const active = typeof document === "undefined" ? null : document.activeElement;
    const onARow =
      active instanceof HTMLElement &&
      active.matches("tr[data-row-id]") &&
      bodyRef.current?.contains(active);
    if (element && onARow && active !== element) {
      element.focus?.({ preventScroll: true });
    }
  }, [navigationRowId, activeIndex, sticky, viewportMaxHeight]);
  const columnCount = renderedColumns.length + (trailingSpace ? 1 : 0);
  const renderedIds = renderedColumns.map((column) => column.id);
  // JSON, not a comma-joined string: a column id may contain a comma, and
  // splitting one back apart would report columns that do not exist (and let
  // two different sets share a key, so the host is never told).
  const renderedKey = JSON.stringify(renderedIds);
  const renderedRef = useRef(onRenderedColumnsChange);
  renderedRef.current = onRenderedColumnsChange;
  const renderedIdsRef = useRef(renderedIds);
  renderedIdsRef.current = renderedIds;
  useEffect(() => {
    renderedRef.current?.(renderedIdsRef.current);
  }, [renderedKey]);
  const rovingEntryId =
    activeIndex >= 0
      ? navigationRowId
      : virtual.items.map((item) => rows[item.index]).find((row) => !row.getIsGrouped())?.id;
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
      data-list-root=""
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
          const next = Math.abs(event.currentTarget.scrollLeft) > 0;
          setScrolledX((current) => (current === next ? current : next));
        }}
        onKeyDownCapture={virtual.onKeyDownCapture}
        data-list-scroller=""
        role="region"
        aria-label={`${ariaLabel ?? "Table"} scroll area`}
        tabIndex={0}
        style={
          bounded
            ? { maxHeight: viewportMaxHeight, height: keepHeight ? viewportMaxHeight : undefined }
            : undefined
        }
        className={cn(
          filling ? "min-h-0 flex-1 overflow-auto" : bounded ? "overflow-auto" : "overflow-x-auto",
        )}
      >
        <table
          className="caption-bottom text-sm"
          style={{ tableLayout: "fixed", width: Math.max(availableWidth, tableWidth) }}
          aria-label={ariaLabel}
          aria-rowcount={virtual.enabled ? rows.length + table.getHeaderGroups().length : undefined}
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
                    // Only when there IS a row to let go of. One Escape, one
                    // effect: it clears the active row without also leaving
                    // focus mode — but with no active row it belongs to the
                    // frame, so it is left alone to bubble there.
                    if (!activeRowId) return;
                    onActiveRowChange(null);
                    event.stopPropagation();
                    event.nativeEvent.stopImmediatePropagation();
                  } else return;
                  event.preventDefault();
                }
              : undefined
          }
        >
          <colgroup>
            {renderedColumns.map((column) => (
              <col key={column.id} style={{ width: sizes.get(column.id) }} />
            ))}
            {trailingSpace ? <col /> : null}
          </colgroup>
          <thead
            className={cn(sticky && "sticky top-0 z-10 bg-card")}
            // A sticky surface must cover rows even when a host applies a
            // translucent header utility for ordinary, non-scrolling tables.
            style={sticky ? { backgroundColor: "var(--card)" } : undefined}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/45">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  // A grouping header spans its leaves; when the width gate
                  // drops some of them it has to narrow, and when it drops all
                  // of them the group header goes too.
                  const span = fittingLeafCount(header);
                  if (span === 0) return null;
                  // `getSize()` sums EVERY descendant, including the ones the
                  // width gate just dropped, so a half-gated group would hold
                  // space for a column that is not there and push the table
                  // wider than its own columns.
                  const sized = fittingLeafWidth(header);
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
                        width: sized,
                        ...pinnedStyle(header.column.id),
                      }}
                      className={cn(
                        "relative h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.headerClassName,
                      )}
                    >
                      <div className="-m-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap p-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                      {!header.isPlaceholder &&
                        !header.subHeaders.length &&
                        header.column.getCanResize() && (
                          <DataTableColumnResize
                            column={header.column}
                            table={table}
                            width={sized}
                            terminal={
                              !trailingSpace &&
                              header.column.id === renderedColumns[renderedColumns.length - 1]?.id
                            }
                          />
                        )}
                    </th>
                  );
                })}
                {trailingSpace ? <th aria-hidden="true" className="p-0" /> : null}
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
              virtual.items.map((item, itemIndex) => {
                const row = rows[item.index];
                const gap = virtual.before(itemIndex);
                return (
                  <Fragment key={row.id}>
                    {gap > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={columnCount} style={{ height: gap, padding: 0, border: 0 }} />
                      </tr>
                    ) : null}
                    {row.getIsGrouped() ? (
                      <tr
                        key={row.id}
                        ref={virtual.measureElement}
                        data-index={item.index}
                        aria-rowindex={
                          virtual.enabled
                            ? item.index + table.getHeaderGroups().length + 1
                            : undefined
                        }
                        data-virtual-row-id={row.id}
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
                        ref={virtual.measureElement}
                        data-index={item.index}
                        aria-rowindex={
                          virtual.enabled
                            ? item.index + table.getHeaderGroups().length + 1
                            : undefined
                        }
                        data-row-id={row.id}
                        data-virtual-row-id={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        data-active={activeRowId != null && row.id === activeRowId ? "" : undefined}
                        aria-current={
                          activeRowId != null && row.id === activeRowId ? "true" : undefined
                        }
                        aria-selected={row.getIsSelected() || undefined}
                        data-clickable={onRowClick || onRowOpen ? "" : undefined}
                        data-focusable={
                          onRowClick || onRowOpen || onActiveRowChange ? "" : undefined
                        }
                        tabIndex={
                          internalNavigation && virtual.enabled
                            ? row.id === rovingEntryId
                              ? 0
                              : -1
                            : onRowClick || onRowOpen || onActiveRowChange
                              ? 0
                              : undefined
                        }
                        // `detail` counts the clicks in the sequence: the second
                        // one belongs to the double-click that follows, and
                        // letting it through would toggle a selection off again
                        // right before the row opens.
                        onFocus={(event) => {
                          if (internalNavigation && event.target === event.currentTarget)
                            setLocalActiveRow(row);
                        }}
                        onClick={(event) => {
                          if (event.detail > 1) return;
                          if (
                            internalNavigation &&
                            !(event.target as HTMLElement).closest(INTERACTIVE)
                          )
                            setLocalActiveRow(row);
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
                          (onRowClick || onRowOpen) && "cursor-pointer hover:bg-muted/30",
                          // Anything focusable has to SHOW where the keyboard is —
                          // a list navigated with the arrows is focusable without
                          // being clickable, and silent focus leaves a keyboard
                          // user guessing which row the next key belongs to.
                          (onRowClick || onRowOpen || onActiveRowChange) &&
                            "focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
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
                              <div
                                data-cell-content=""
                                className="-m-1 min-w-0 overflow-hidden p-1"
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            </td>
                          );
                        })}
                        {trailingSpace ? <td aria-hidden="true" className="p-0" /> : null}
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
            {virtual.after > 0 ? (
              <tr aria-hidden="true">
                <td
                  colSpan={columnCount}
                  style={{ height: virtual.after, padding: 0, border: 0 }}
                />
              </tr>
            ) : null}
          </tbody>
        </table>
        {virtual.enabled && virtual.hasTabTargets ? (
          <span
            tabIndex={0}
            data-virtual-boundary=""
            className="sr-only"
            onFocus={(event) =>
              virtual.onBoundaryFocus(
                event.currentTarget,
                bodyRef.current?.parentElement?.contains(event.relatedTarget as Node) ? 1 : -1,
              )
            }
          >
            End of table
          </span>
        ) : null}
      </div>
      <DataTableOverflow scroller={scrollerRef} />
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
