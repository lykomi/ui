/**
 * The whole user-facing state of a DataTable as one value, plus a URL codec.
 *
 * URL keys are shared with the older collection pages (`q`, `sort`, `f_<id>`)
 * so a link that worked before keeps working; `hide`, `page` and `size` are
 * new. Selection and expansion are never put in the URL.
 */
import type {
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

export interface DataTableState {
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  pagination: PaginationState;
  expanded: ExpandedState;
}

export const DEFAULT_PAGE_SIZE = 20;

export const EMPTY_DATA_TABLE_STATE: DataTableState = {
  globalFilter: "",
  columnFilters: [],
  sorting: [],
  columnVisibility: {},
  rowSelection: {},
  pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  expanded: true,
};

const FILTER_PREFIX = "f_";
const OWN_KEYS = new Set(["q", "sort", "hide", "page", "size"]);

export function isDataTableUrlKey(key: string): boolean {
  return OWN_KEYS.has(key) || key.startsWith(FILTER_PREFIX);
}

function encodePart(value: string): string {
  return value.replace(/%/g, "%25").replace(/,/g, "%2C");
}

function decodePart(value: string): string {
  return value.replace(/%2C/gi, ",").replace(/%25/g, "%");
}

export interface DataTableUrlOptions {
  /** Page size that is implied when `size` is absent (default 20). */
  defaultPageSize?: number;
}

/** Serialize the URL-worthy part of the state; unset keys are omitted. */
export function serializeDataTableState(
  state: Partial<DataTableState>,
  options?: DataTableUrlOptions,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.globalFilter) params.set("q", state.globalFilter);
  if (state.sorting?.length) {
    params.set("sort", state.sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(","));
  }
  for (const filter of state.columnFilters ?? []) {
    const values = Array.isArray(filter.value)
      ? filter.value.map(String).filter(Boolean)
      : filter.value == null || filter.value === ""
        ? []
        : [String(filter.value)];
    if (values.length) params.set(`${FILTER_PREFIX}${filter.id}`, values.map(encodePart).join(","));
  }
  const hidden = Object.entries(state.columnVisibility ?? {})
    .filter(([, visible]) => visible === false)
    .map(([id]) => id);
  if (hidden.length) params.set("hide", hidden.map(encodePart).join(","));
  const pagination = state.pagination;
  if (pagination) {
    if (pagination.pageIndex > 0) params.set("page", String(pagination.pageIndex + 1));
    const defaultSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
    if (pagination.pageSize !== defaultSize) params.set("size", String(pagination.pageSize));
  }
  return params;
}

/** Parse a URL into a full state; `defaults` fill what the URL doesn't say. */
export function parseDataTableState(
  params: URLSearchParams,
  options?: DataTableUrlOptions & { defaults?: Partial<DataTableState> },
): DataTableState {
  const defaults = { ...EMPTY_DATA_TABLE_STATE, ...options?.defaults };
  const defaultSize = options?.defaultPageSize ?? defaults.pagination.pageSize;
  const sortRaw = params.get("sort");
  const sorting: SortingState = sortRaw
    ? sortRaw
        .split(",")
        .filter(Boolean)
        .map((part) =>
          part.startsWith("-") ? { id: part.slice(1), desc: true } : { id: part, desc: false },
        )
    : defaults.sorting;
  const columnFilters: ColumnFiltersState = [];
  for (const [key, raw] of params.entries()) {
    if (!key.startsWith(FILTER_PREFIX) || !raw) continue;
    const values = raw.split(",").filter(Boolean).map(decodePart);
    if (values.length) columnFilters.push({ id: key.slice(FILTER_PREFIX.length), value: values });
  }
  const columnVisibility: VisibilityState = { ...defaults.columnVisibility };
  const hideRaw = params.get("hide");
  if (hideRaw != null) {
    for (const id of Object.keys(columnVisibility))
      if (columnVisibility[id] === false) delete columnVisibility[id];
    for (const id of hideRaw.split(",").filter(Boolean).map(decodePart))
      columnVisibility[id] = false;
  }
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const size = Number.parseInt(params.get("size") ?? "", 10);
  return {
    ...defaults,
    globalFilter: params.get("q") ?? defaults.globalFilter,
    sorting,
    columnFilters: hasFilterKey(params) ? columnFilters : defaults.columnFilters,
    columnVisibility,
    pagination: {
      pageIndex: Number.isFinite(page) && page > 1 ? page - 1 : 0,
      pageSize: Number.isFinite(size) && size > 0 ? size : defaultSize,
    },
  };
}

function hasFilterKey(params: URLSearchParams): boolean {
  for (const key of params.keys()) if (key.startsWith(FILTER_PREFIX)) return true;
  return false;
}

/** Replace this table's keys in `params`, leaving every other key untouched. */
export function mergeDataTableUrlState(
  params: URLSearchParams,
  state: Partial<DataTableState>,
  options?: DataTableUrlOptions,
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) if (!isDataTableUrlKey(key)) next.append(key, value);
  for (const [key, value] of serializeDataTableState(state, options).entries())
    next.set(key, value);
  return next;
}
