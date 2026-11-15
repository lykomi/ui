import { DEFAULT_COLUMN_MIN_SIZE, DEFAULT_COLUMN_MAX_SIZE } from "./column-sizing.ts";
/**
 * One hook that turns rows + columns into a fully wired TanStack table:
 * token search, faceted filters, sorting, column visibility, selection,
 * optional pagination and optional single-level grouping — with the whole
 * state as ONE value so it can live in component state or in the URL.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type Row,
  type Table,
  type TableOptions,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { facetFilterFn, tokenSearchFilterFn } from "./facets.ts";
import { DEFAULT_PAGE_SIZE, EMPTY_DATA_TABLE_STATE, type DataTableState } from "./state.ts";

export interface UseDataTableOptions<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  /** Stable row id (defaults to the row index). Required for selection that survives re-sorting. */
  getRowId?: (row: T, index: number, parent?: Row<T>) => string;
  /** Controlled state — pair with `onStateChange` (e.g. URL-bound). */
  state?: Partial<DataTableState>;
  onStateChange?: (next: DataTableState) => void;
  /** Uncontrolled start state. */
  initialState?: Partial<DataTableState>;
  /** Rows per page; omit (or `false`) for an unpaginated table. Ignored while grouped. */
  pageSize?: number | false;
  /** Column id to group rows by (one level). */
  groupBy?: string | null;
  enableRowSelection?: boolean | ((row: Row<T>) => boolean);
  enableMultiRowSelection?: boolean;
  /** Replace the default AND-of-tokens search. */
  globalFilterFn?: FilterFn<T>;
  /** Defaults for content columns; individual definitions override them. */
  defaultColumn?: TableOptions<T>["defaultColumn"];
  /** The data source applies filters/sorting before returning a batch. */
  manualFiltering?: boolean;
  manualSorting?: boolean;
}

const PAGE_RESET_KEYS = new Set<keyof DataTableState>(["globalFilter", "columnFilters", "sorting"]);

/**
 * TanStack's own rule for a column's id, mirrored so `meta.defaultHidden` can
 * be resolved before the table exists: an explicit `id`, else the
 * `accessorKey` with EVERY dot turned into an underscore (`user.profile.name`
 * → `user_profile_name`), else a string header. Anything else has no stable
 * id to key visibility by.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function columnId<T>(column: ColumnDef<T, any>): string | undefined {
  if (column.id) return column.id;
  const accessorKey = "accessorKey" in column ? column.accessorKey : undefined;
  if (accessorKey != null) return String(accessorKey).replace(/\./g, "_");
  return typeof column.header === "string" ? column.header : undefined;
}

/**
 * `{ id: false }` for every column whose `meta.defaultHidden` says it starts
 * out of the way — the leaves, since visibility is a leaf property and a
 * grouping header has no state to hide.
 *
 * `useDataTable` applies this to its own initial state. A list whose state
 * lives somewhere else (the URL) must pass it as part of that layer's
 * `defaults` instead: re-applying it on every render would undo the user the
 * moment they bring a column out, because "visible" is exactly what a
 * hidden-only URL does not record.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultHiddenColumns<T>(columns: readonly ColumnDef<T, any>[]): VisibilityState {
  const hidden: VisibilityState = {};
  const walk = (defs: readonly ColumnDef<T, any>[]) => {
    for (const column of defs) {
      const children = "columns" in column ? column.columns : undefined;
      if (children?.length) {
        walk(children);
        continue;
      }
      const id = columnId(column);
      if (id && column.meta?.defaultHidden) hidden[id] = false;
    }
  };
  walk(columns);
  return hidden;
}

export function useDataTable<T>(options: UseDataTableOptions<T>): Table<T> {
  const {
    data,
    columns,
    getRowId,
    state: controlledState,
    onStateChange,
    initialState,
    pageSize,
    groupBy,
    enableRowSelection = false,
    enableMultiRowSelection = true,
    globalFilterFn,
    defaultColumn,
    manualFiltering,
    manualSorting,
  } = options;
  const controlled = controlledState !== undefined && onStateChange !== undefined;

  const basePageSize = pageSize || DEFAULT_PAGE_SIZE;
  const defaultHidden = useMemo(() => defaultHiddenColumns(columns), [columns]);
  const [innerState, setInnerState] = useState<DataTableState>(() => ({
    ...EMPTY_DATA_TABLE_STATE,
    ...initialState,
    columnVisibility: { ...defaultHidden, ...initialState?.columnVisibility },
    pagination: { pageIndex: 0, pageSize: basePageSize, ...initialState?.pagination },
  }));
  const state = useMemo<DataTableState>(
    () =>
      controlled
        ? {
            ...EMPTY_DATA_TABLE_STATE,
            ...controlledState,
            pagination: { pageIndex: 0, pageSize: basePageSize, ...controlledState.pagination },
          }
        : innerState,
    [basePageSize, controlled, controlledState, innerState],
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const tableRef = useRef<Table<T> | null>(null);

  const update = useCallback(
    <K extends keyof DataTableState>(key: K, updater: Updater<DataTableState[K]>) => {
      const current = stateRef.current;
      const value =
        typeof updater === "function"
          ? (updater as (old: DataTableState[K]) => DataTableState[K])(current[key])
          : updater;
      if (Object.is(value, current[key])) return;
      const next: DataTableState = { ...current, [key]: value };
      if (PAGE_RESET_KEYS.has(key) && next.pagination.pageIndex !== 0) {
        next.pagination = { ...next.pagination, pageIndex: 0 };
      }
      stateRef.current = next;
      // Apply to the instance now, not on the next render: a caller that
      // reads row models right after a mutation (agent tools, tests) sees
      // the new state even while the host owns it (URL, store).
      tableRef.current?.setOptions((prev) => ({
        ...prev,
        state: { ...prev.state, [key]: value, pagination: next.pagination },
      }));
      if (controlled) onStateChange(next);
      else setInnerState(next);
    },
    [controlled, onStateChange],
  );

  const grouped = Boolean(groupBy);
  const tableOptions: TableOptions<T> = {
    manualFiltering,
    manualSorting,
    data,
    columns,
    defaultColumn: {
      minSize: DEFAULT_COLUMN_MIN_SIZE,
      maxSize: DEFAULT_COLUMN_MAX_SIZE,
      ...defaultColumn,
    },
    getRowId,
    state: { ...state, grouping: groupBy ? [groupBy] : [] },
    onGlobalFilterChange: (updater) => update("globalFilter", updater),
    onColumnFiltersChange: (updater) => update("columnFilters", updater),
    onSortingChange: (updater) => update("sorting", updater),
    onColumnSizingChange: (updater) => update("columnSizing", updater),
    onColumnVisibilityChange: (updater) => update("columnVisibility", updater),
    onRowSelectionChange: (updater) => update("rowSelection", updater),
    onPaginationChange: (updater) => update("pagination", updater),
    onExpandedChange: (updater) => update("expanded", updater),
    // String alias for untyped column defs (JSX renderers): `filterFn: "facet"`.
    filterFns: { facet: facetFilterFn },
    globalFilterFn: globalFilterFn ?? tokenSearchFilterFn,
    getColumnCanGlobalFilter: (column) =>
      column.columnDef.enableGlobalFilter ?? column.accessorFn != null,
    enableRowSelection,
    enableMultiRowSelection,
    groupedColumnMode: false,
    autoResetPageIndex: false,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  };
  if (grouped) {
    tableOptions.getGroupedRowModel = getGroupedRowModel();
    tableOptions.getExpandedRowModel = getExpandedRowModel();
  } else if (pageSize) {
    tableOptions.getPaginationRowModel = getPaginationRowModel();
  }
  const table = useReactTable(tableOptions);
  tableRef.current = table;

  // A shrinking data set (or a tighter filter) can strand a later page.
  useEffect(() => {
    if (grouped || !pageSize) return;
    const index = table.getState().pagination.pageIndex;
    const count = table.getPageCount();
    if (index > 0 && index >= count) table.setPageIndex(Math.max(0, count - 1));
  });
  return table;
}
