/**
 * The whole user-facing state of a DataTable as one value, plus a URL codec.
 *
 * URL keys are shared with the older collection pages (`q`, `sort`, `f_<id>`)
 * so a link that worked before keeps working; `hide`, `page` and `size` are
 * new. Selection and expansion are never put in the URL. A present-but-empty
 * key (`f_status=`, `sort=`, `hide=`, `q=`) means "cleared", so a default the
 * host configured can be switched off by the user and survive a reload.
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
const OWN_KEYS = ["q", "sort", "hide", "page", "size"] as const;

/** `prefix` namespaces every key (`risks.q`, `risks.f_status`) so two lists can share a page. */
export function isDataTableUrlKey(key: string, prefix = ""): boolean {
  if (!key.startsWith(prefix)) return false;
  const bare = key.slice(prefix.length);
  return (OWN_KEYS as readonly string[]).includes(bare) || bare.startsWith(FILTER_PREFIX);
}

function encodePart(value: string): string {
  return value.replace(/%/g, "%25").replace(/,/g, "%2C");
}

function decodePart(value: string): string {
  return value.replace(/%2C/gi, ",").replace(/%2D/gi, "-").replace(/%25/g, "%");
}

/** Sort ids may contain commas or start with "-"; both are escaped. */
function encodeSortId(id: string): string {
  const encoded = encodePart(id);
  return encoded.startsWith("-") ? `%2D${encoded.slice(1)}` : encoded;
}

function filterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value == null || value === "" ? [] : [String(value)];
}

export interface DataTableUrlOptions {
  /** Key namespace for pages with several lists (`"risks."` → `risks.q`, `risks.f_status`). */
  prefix?: string;
  /** Page size that is implied when `size` is absent (default 20). */
  defaultPageSize?: number;
  /**
   * State implied when the URL says nothing. Serializing writes an explicit
   * empty key when the user cleared a value the defaults would bring back.
   */
  defaults?: Partial<DataTableState>;
}

function sortKey(sorting: SortingState | undefined): string {
  return (sorting ?? [])
    .map((s) => (s.desc ? `-${encodeSortId(s.id)}` : encodeSortId(s.id)))
    .join(",");
}

function hiddenKey(visibility: VisibilityState | undefined): string {
  return Object.entries(visibility ?? {})
    .filter(([, visible]) => visible === false)
    .map(([id]) => encodePart(id))
    .sort()
    .join(",");
}

/**
 * Serialize the URL-worthy part of the state. A key whose value equals the
 * default is omitted; a key the user cleared while a default exists is
 * written empty; a key absent from a partial `state` is omitted.
 */
export function serializeDataTableState(
  state: Partial<DataTableState>,
  options?: DataTableUrlOptions,
): URLSearchParams {
  const defaults = options?.defaults ?? {};
  const prefix = options?.prefix ?? "";
  const params = new URLSearchParams();
  if (state.globalFilter !== undefined && state.globalFilter !== (defaults.globalFilter ?? "")) {
    params.set(`${prefix}q`, state.globalFilter);
  }
  if (state.sorting !== undefined && sortKey(state.sorting) !== sortKey(defaults.sorting)) {
    params.set(`${prefix}sort`, sortKey(state.sorting));
  }
  if (state.columnFilters !== undefined) {
    const current = new Map(
      state.columnFilters.map((f) => [f.id, filterValues(f.value).map(encodePart).join(",")]),
    );
    const base = new Map(
      (defaults.columnFilters ?? []).map((f) => [
        f.id,
        filterValues(f.value).map(encodePart).join(","),
      ]),
    );
    for (const id of new Set([...current.keys(), ...base.keys()])) {
      const value = current.get(id) ?? "";
      if (value !== (base.get(id) ?? "")) params.set(`${prefix}${FILTER_PREFIX}${id}`, value);
    }
  }
  if (
    state.columnVisibility !== undefined &&
    hiddenKey(state.columnVisibility) !== hiddenKey(defaults.columnVisibility)
  ) {
    params.set(`${prefix}hide`, hiddenKey(state.columnVisibility));
  }
  const pagination = state.pagination;
  if (pagination) {
    const defaultIndex = defaults.pagination?.pageIndex ?? 0;
    if (pagination.pageIndex !== defaultIndex) {
      params.set(`${prefix}page`, String(pagination.pageIndex + 1));
    }
    const defaultSize =
      options?.defaultPageSize ?? defaults.pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    if (pagination.pageSize !== defaultSize)
      params.set(`${prefix}size`, String(pagination.pageSize));
  }
  return params;
}

/** Parse a URL into a full state; `defaults` fill what the URL doesn't say. */
export function parseDataTableState(
  params: URLSearchParams,
  options?: DataTableUrlOptions,
): DataTableState {
  const defaults = { ...EMPTY_DATA_TABLE_STATE, ...options?.defaults };
  const prefix = options?.prefix ?? "";
  const filterPrefix = `${prefix}${FILTER_PREFIX}`;
  const defaultSize = options?.defaultPageSize ?? defaults.pagination.pageSize;
  const sortRaw = params.get(`${prefix}sort`);
  const sorting: SortingState =
    sortRaw == null
      ? defaults.sorting
      : sortRaw
          .split(",")
          .filter(Boolean)
          .map((part) =>
            part.startsWith("-")
              ? { id: decodePart(part.slice(1)), desc: true }
              : { id: decodePart(part), desc: false },
          );
  const filtersById = new Map(defaults.columnFilters.map((filter) => [filter.id, filter] as const));
  for (const [key, raw] of params.entries()) {
    if (!key.startsWith(filterPrefix)) continue;
    const id = key.slice(filterPrefix.length);
    const values = raw.split(",").filter(Boolean).map(decodePart);
    if (values.length) filtersById.set(id, { id, value: values });
    else filtersById.delete(id);
  }
  const columnFilters: ColumnFiltersState = Array.from(filtersById.values());
  const columnVisibility: VisibilityState = { ...defaults.columnVisibility };
  const hideRaw = params.get(`${prefix}hide`);
  if (hideRaw != null) {
    for (const id of Object.keys(columnVisibility)) {
      if (columnVisibility[id] === false) delete columnVisibility[id];
    }
    for (const id of hideRaw.split(",").filter(Boolean).map(decodePart))
      columnVisibility[id] = false;
  }
  const pageRaw = params.get(`${prefix}page`);
  const page = Number.parseInt(pageRaw ?? "", 10);
  const size = Number.parseInt(params.get(`${prefix}size`) ?? "", 10);
  return {
    ...defaults,
    globalFilter: params.has(`${prefix}q`)
      ? (params.get(`${prefix}q`) ?? "")
      : defaults.globalFilter,
    sorting,
    columnFilters,
    columnVisibility,
    pagination: {
      pageIndex:
        pageRaw == null
          ? defaults.pagination.pageIndex
          : Number.isFinite(page) && page > 1
            ? page - 1
            : 0,
      pageSize: Number.isFinite(size) && size > 0 ? size : defaultSize,
    },
  };
}

/** Replace this table's keys in `params`, leaving every other key untouched. */
export function mergeDataTableUrlState(
  params: URLSearchParams,
  state: Partial<DataTableState>,
  options?: DataTableUrlOptions,
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (!isDataTableUrlKey(key, options?.prefix)) next.append(key, value);
  }
  for (const [key, value] of serializeDataTableState(state, options).entries())
    next.set(key, value);
  return next;
}
