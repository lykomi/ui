/**
 * One hook that turns rows + columns into a fully wired TanStack table:
 * token search, faceted filters, sorting, column visibility, selection,
 * optional pagination and optional single-level grouping — with the whole
 * state as ONE value so it can live in component state or in the URL.
 */
import { useCallback, useMemo, useRef, useState } from "react";
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
}

const PAGE_RESET_KEYS = new Set<keyof DataTableState>(["globalFilter", "columnFilters", "sorting"]);

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
  } = options;
  const controlled = controlledState !== undefined && onStateChange !== undefined;

  const [innerState, setInnerState] = useState<DataTableState>(() => ({
    ...EMPTY_DATA_TABLE_STATE,
    pagination: { pageIndex: 0, pageSize: pageSize || DEFAULT_PAGE_SIZE },
    ...initialState,
  }));
  const state = useMemo<DataTableState>(
    () => (controlled ? { ...EMPTY_DATA_TABLE_STATE, ...controlledState } : innerState),
    [controlled, controlledState, innerState],
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
    data,
    columns,
    getRowId,
    state: { ...state, grouping: groupBy ? [groupBy] : [] },
    onGlobalFilterChange: (updater) => update("globalFilter", updater),
    onColumnFiltersChange: (updater) => update("columnFilters", updater),
    onSortingChange: (updater) => update("sorting", updater),
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
  return table;
}
