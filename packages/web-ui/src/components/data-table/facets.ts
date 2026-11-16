/**
 * Facet semantics shared by every DataTable: how a cell value turns into
 * facet keys, how a facet filter matches (OR within one facet — the table
 * ANDs facets together), and how option counts are derived from the rows
 * that every *other* filter lets through (TanStack's faceted row model), so
 * a count always reads "rows you'd see if you added this option".
 */
import type { Column, FilterFn, Row, RowData } from "@tanstack/react-table";
import type { ComponentType } from "react";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Label for the View menu, facet titles and agent descriptions (defaults to a string header, then the id). */
    label?: string;
    /** Class for body cells of this column. */
    className?: string;
    /** Class for the header cell of this column. */
    headerClassName?: string;
    /** Positive weight for sharing spare viewport width, bounded by min/maxSize. Explicit user widths win. */
    grow?: number;
    /** Horizontal alignment of header and cells. */
    align?: "left" | "center" | "right";
    /** Text the global search sees for this column instead of the cell value. */
    searchText?: (row: TData) => string;
    /** Labels for facet keys and group headers (`value → label`). */
    facetLabels?: Record<string, string>;
    /** Narrowest list width the column is shown at; below it the column hides (the Columns menu still lists it). */
    breakpoint?: DataTableBreakpoint;
    /**
     * Which mode the column earns its place in. `"always"` (default) means
     * wherever it fits; `"focus"` keeps it for when the list has the screen
     * to itself, so a page-embedded list stays scannable and going
     * fullscreen actually shows you more.
     */
    showIn?: "always" | "focus";
    /** Start hidden: available in the Columns menu, off until asked for. */
    defaultHidden?: boolean;
    /**
     * Turn a raw value into the facet keys it belongs to — how a number or a
     * date becomes something you can tick: "≥ 50 %", "overdue", "this week".
     * The rest of the machinery (counts, OR within, AND across, the URL, the
     * agent tools) works on those keys unchanged.
     */
    facetBuckets?: (value: unknown) => string[];
    /** Freeze the column against the left edge while the table scrolls sideways. */
    pinned?: "left";
    /** Keep unused type parameter referenced for declaration merging. */
    __cellValue?: TValue;
    /** Hosts may carry their own keys in `meta` (e.g. a server sort key). */
    [key: string]: unknown;
  }
}

/**
 * How much room a column needs. Measured against the *list's* own width, not
 * the window — so a list beside an open detail pane sheds columns and gets
 * them back in focus mode, with no work from the host.
 *
 * `sm` 448px · `md` 672px · `lg` 896px · `xl` 1024px · `2xl` 1280px.
 */
export type DataTableBreakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * The list width at which each band starts earning its columns. Measured on
 * the list itself, not the viewport — a list in a side pane is narrow even on
 * a wide screen. Exported so a host that derives breakpoints from a schema
 * measures against the same numbers the table renders by.
 */
export const DATA_TABLE_MIN_WIDTH: Record<DataTableBreakpoint, number> = {
  sm: 448,
  md: 672,
  lg: 896,
  xl: 1024,
  "2xl": 1280,
};

/** Facet key for empty cells (`null`, `undefined`, `""`, `[]`). */
export const FACET_EMPTY = "__none__";

export interface DataTableFacetOption {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface DataTableFacetCount extends DataTableFacetOption {
  count: number;
}

/**
 * Keys a cell value contributes to a facet — arrays contribute one key per
 * element. A real value that spells the empty sentinel is escaped with a
 * leading backslash so it never masquerades as "no value".
 */
export function columnFacetKeys<T>(column: Column<T, unknown>, value: unknown): string[] {
  const buckets = column.columnDef.meta?.facetBuckets;
  if (!buckets) return facetKeys(value);
  // Unique, like `facetKeys` is for arrays: a bucket rule that overlaps
  // itself would otherwise count one row twice and report a facet with more
  // matches than there are rows.
  const keys = Array.from(new Set(buckets(value).filter((key) => key !== "")));
  return keys.length ? keys : [FACET_EMPTY];
}

export function facetKeys(value: unknown): string[] {
  if (value == null || value === "") return [FACET_EMPTY];
  if (value === FACET_EMPTY) return [`\\${FACET_EMPTY}`];
  if (Array.isArray(value)) {
    const keys = value.flatMap((item) => facetKeys(item)).filter((key) => key !== FACET_EMPTY);
    return keys.length ? Array.from(new Set(keys)) : [FACET_EMPTY];
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const key = record.id ?? record.value ?? record.name;
    return key == null || key === "" ? [FACET_EMPTY] : [String(key)];
  }
  return [String(value)];
}

// TanStack memoizes a row's cells, so the array identity is a safe cache key:
// the id → column map is built once per row instead of scanned once per row
// per active filter (a scan that is O(columns) on every pass over the data).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowColumnCache = new WeakMap<object, Map<string, Column<any, unknown>>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function columnOfRow(row: Row<any>, columnId: string): Column<any, unknown> | undefined {
  const cells = row.getAllCells();
  let byId = rowColumnCache.get(cells);
  if (!byId) {
    byId = new Map(cells.map((cell) => [cell.column.id, cell.column]));
    rowColumnCache.set(cells, byId);
  }
  return byId.get(columnId);
}

/** A facet filter value is a list of selected keys; anything else means "no filter". */
export function normalizeFacetValue(filterValue: unknown): string[] {
  if (Array.isArray(filterValue)) return filterValue.map(String).filter(Boolean);
  if (filterValue == null || filterValue === "") return [];
  return [String(filterValue)];
}

/**
 * OR within a facet: a row passes when any of its keys is selected. Typed
 * loosely so `filterFn: facetFilterFn` fits any row type; `useDataTable`
 * also registers it as the string `"facet"` for untyped (JSX) columns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const facetFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const wanted = normalizeFacetValue(filterValue);
  if (!wanted.length) return true;
  const column = columnOfRow(row, columnId);
  const keys = column
    ? columnFacetKeys(column, row.getValue(columnId))
    : facetKeys(row.getValue(columnId));
  return keys.some((key) => wanted.includes(key));
};
facetFilterFn.autoRemove = (value) => normalizeFacetValue(value).length === 0;

/** Rows per facet key, counted over the rows every OTHER filter lets through. */
export function facetCounts<T>(column: Column<T, unknown>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of column.getFacetedRowModel().flatRows) {
    for (const key of columnFacetKeys(column, row.getValue(column.id))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export interface FacetOptionsOptions {
  /** Authoritative counts from a remote query, excluding this facet's own filter. */
  counts?: ReadonlyMap<string, number>;
  /** Label for keys that are neither declared nor in `meta.facetLabels`. */
  labelFor?: (key: string) => string;
  /** Label for the empty-cell option (default "None"). */
  emptyLabel?: string;
}

/**
 * Declared options first (in declared order, kept even at count 0), then
 * every undeclared key seen in the data, then the empty option when some
 * rows have no value.
 */
export function facetOptions<T>(
  column: Column<T, unknown>,
  declared?: DataTableFacetOption[],
  options?: FacetOptionsOptions,
): DataTableFacetCount[] {
  const counts = options?.counts ?? facetCounts(column);
  const labels = column.columnDef.meta?.facetLabels ?? {};
  const labelFor = (key: string) => labels[key] ?? options?.labelFor?.(key) ?? key;
  const seen = new Set<string>();
  const out: DataTableFacetCount[] = [];
  for (const option of declared ?? []) {
    seen.add(option.value);
    out.push({ ...option, count: counts.get(option.value) ?? 0 });
  }
  const rest = Array.from(counts.keys())
    .filter((key) => !seen.has(key) && key !== FACET_EMPTY)
    .sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  for (const key of rest)
    out.push({ value: key, label: labelFor(key), count: counts.get(key) ?? 0 });
  if (counts.has(FACET_EMPTY) && !seen.has(FACET_EMPTY)) {
    out.push({
      value: FACET_EMPTY,
      label: labels[FACET_EMPTY] ?? options?.emptyLabel ?? "None",
      count: counts.get(FACET_EMPTY) ?? 0,
    });
  }
  return out;
}

/** Plain-text projection of a cell value for search and agent read-outs. */
export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") return record.name;
    if (typeof record.label === "string") return record.label;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

const searchTextCache = new WeakMap<object, { cells: unknown; text: string }>();

/**
 * Lower-cased text of every searchable cell of a row. Cached per row object
 * and invalidated when the row's cells change identity (new columns or a
 * changed `meta.searchText`), since TanStack keeps row objects across
 * column changes.
 */
export function rowSearchText<T>(row: Row<T>): string {
  const cells = row.getAllCells();
  const cached = searchTextCache.get(row);
  if (cached && cached.cells === cells) return cached.text;
  const text = cells
    .filter((cell) => cell.column.getCanGlobalFilter())
    .map((cell) => {
      const custom = cell.column.columnDef.meta?.searchText;
      return custom ? custom(row.original) : cellText(cell.getValue());
    })
    .join(" ")
    .toLowerCase();
  searchTextCache.set(row, { cells, text });
  return text;
}

/** Every whitespace-separated token must appear somewhere in the row (AND across tokens). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tokenSearchFilterFn: FilterFn<any> = (row, _columnId, filterValue) => {
  const tokens = String(filterValue ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return true;
  const hay = rowSearchText(row);
  return tokens.every((token) => hay.includes(token));
};
tokenSearchFilterFn.autoRemove = (value) => !String(value ?? "").trim();

/** Human label of a column: `meta.label`, then a string header, then the id. */
export function columnLabel<T>(column: Column<T, unknown>): string {
  const meta = column.columnDef.meta;
  if (meta?.label) return meta.label;
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}
