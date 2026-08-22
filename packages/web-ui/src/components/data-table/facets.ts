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
    /** Horizontal alignment of header and cells. */
    align?: "left" | "center" | "right";
    /** Text the global search sees for this column instead of the cell value. */
    searchText?: (row: TData) => string;
    /** Labels for facet keys and group headers (`value → label`). */
    facetLabels?: Record<string, string>;
    /** Keep unused type parameter referenced for declaration merging. */
    __cellValue?: TValue;
    /** Hosts may carry their own keys in `meta` (e.g. a server sort key). */
    [key: string]: unknown;
  }
}

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

/** Keys a cell value contributes to a facet — arrays contribute one key per element. */
export function facetKeys(value: unknown): string[] {
  if (value == null || value === "") return [FACET_EMPTY];
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
  return facetKeys(row.getValue(columnId)).some((key) => wanted.includes(key));
};
facetFilterFn.autoRemove = (value) => normalizeFacetValue(value).length === 0;

/** Rows per facet key, counted over the rows every OTHER filter lets through. */
export function facetCounts<T>(column: Column<T, unknown>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of column.getFacetedRowModel().flatRows) {
    for (const key of facetKeys(row.getValue(column.id))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export interface FacetOptionsOptions {
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
  const counts = facetCounts(column);
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

const searchTextCache = new WeakMap<object, string>();

/** Lower-cased text of every searchable cell of a row (cached per row object). */
export function rowSearchText<T>(row: Row<T>): string {
  const cached = searchTextCache.get(row);
  if (cached !== undefined) return cached;
  const text = row
    .getAllCells()
    .filter((cell) => cell.column.getCanGlobalFilter())
    .map((cell) => {
      const custom = cell.column.columnDef.meta?.searchText;
      return custom ? custom(row.original) : cellText(cell.getValue());
    })
    .join(" ")
    .toLowerCase();
  searchTextCache.set(row, text);
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
