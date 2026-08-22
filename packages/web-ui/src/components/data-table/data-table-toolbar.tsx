/**
 * Two bands, so a list with many filters still reads as ordered rather than
 * as a ragged wrap:
 *
 *   row 1   search …………………………………… Filters (n) · actions · View · ⤢
 *   row 2   facet · facet · facet · + Filter · Reset
 *
 * Row one never wraps (its right group is fixed); filters live on their own
 * row, and only the *pinned* facets (explicit `pinned`, else the first
 * `pinnedFacets`) sit there — the rest wait behind "+ Filter" and join once
 * chosen or active. On a dense, Excel-like screen the filter row collapses
 * behind the "Filters" toggle, which keeps the active count visible.
 *
 * `layout="inline"` puts everything back on one wrapping row (a small list
 * with one or two facets and no actions).
 */
import type { Table } from "@tanstack/react-table";
import { Maximize2, Minimize2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Input, cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";
import { DataTableFacetedFilter } from "./data-table-faceted-filter.tsx";
import { useDataTableFrame } from "./data-table-frame.tsx";
import { DataTableViewOptions } from "./data-table-view-options.tsx";
import { columnLabel, normalizeFacetValue, type DataTableFacetOption } from "./facets.ts";

export interface DataTableFacet {
  columnId: string;
  title?: string;
  options?: DataTableFacetOption[];
  /** Always show this facet; unset → the first `pinnedFacets` are pinned. */
  pinned?: boolean;
}

export type DataTableToolbarLayout = "auto" | "inline" | "stacked";

export interface DataTableToolbarProps<T> {
  table: Table<T>;
  facets?: DataTableFacet[];
  /** "auto" (default): a filter row as soon as there are facets; "inline": one wrapping row. */
  layout?: DataTableToolbarLayout;
  /** Show the Filters toggle that hides the filter row (default true when stacked). */
  collapsibleFilters?: boolean;
  /** Start with the filter row hidden (the toggle still shows the active count). */
  defaultFiltersOpen?: boolean;
  /** Facets always visible when none declares `pinned` (default 3; `Infinity` shows all). */
  pinnedFacets?: number;
  searchPlaceholder?: string;
  /** Hide the search box. */
  search?: boolean;
  /** Hide the View (column visibility) menu. */
  viewOptions?: boolean;
  /** Hide the focus (fullscreen) button that appears inside a `DataTableFrame`. */
  focus?: boolean;
  /** Extra controls rendered next to the facets (left side). */
  children?: ReactNode;
  /** Controls rendered on the right, before the View menu. */
  actions?: ReactNode;
  className?: string;
}

/** Which facets render as buttons: pinned ones, revealed ones, and any with a value. */
export function visibleFacets<T>(
  table: Table<T>,
  facets: DataTableFacet[],
  revealed: ReadonlySet<string>,
  pinnedFacets: number,
): { shown: DataTableFacet[]; hidden: DataTableFacet[] } {
  const explicit = facets.some((facet) => facet.pinned !== undefined);
  const shown: DataTableFacet[] = [];
  const hidden: DataTableFacet[] = [];
  facets.forEach((facet, index) => {
    const column = table.getColumn(facet.columnId);
    if (!column) return;
    const pinned = explicit ? facet.pinned === true : index < pinnedFacets;
    const active = normalizeFacetValue(column.getFilterValue()).length > 0;
    (pinned || active || revealed.has(facet.columnId) ? shown : hidden).push(facet);
  });
  return { shown, hidden };
}

export function DataTableToolbar<T>({
  table,
  facets = [],
  layout = "auto",
  collapsibleFilters,
  defaultFiltersOpen = true,
  pinnedFacets = 3,
  searchPlaceholder = "Search…",
  search = true,
  viewOptions = true,
  focus = true,
  children,
  actions,
  className,
}: DataTableToolbarProps<T>) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const frame = useDataTableFrame();
  const focusButton =
    focus && frame ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={frame.focused}
        aria-label={frame.focused ? "Leave focus mode" : "Focus on the list"}
        title={frame.focused ? "Leave focus mode (Esc)" : "Focus on the list"}
        onClick={() => frame.setFocused(!frame.focused)}
        className="size-8 rounded-xl border-border/45 bg-background/65 p-0 shadow-none hover:bg-muted/26"
      >
        {frame.focused ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </Button>
    ) : null;
  const state = table.getState();
  const isFiltered =
    state.columnFilters.length > 0 || Boolean(state.globalFilter) || revealed.size > 0;
  const { shown, hidden } = visibleFacets(table, facets, revealed, pinnedFacets);
  const hasFilterRow = facets.length > 0 || Boolean(children);
  const stacked = layout === "stacked" || (layout === "auto" && hasFilterRow);
  const canCollapse = stacked && (collapsibleFilters ?? true);
  const activeFilters = state.columnFilters.length;
  const showFilters = !canCollapse || filtersOpen;
  const facetTitle = (facet: DataTableFacet) => {
    const column = table.getColumn(facet.columnId);
    return facet.title ?? (column ? columnLabel(column) : facet.columnId);
  };
  const searchNode = search ? (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={(state.globalFilter as string) ?? ""}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="h-8 w-[160px] rounded-xl border-border/45 bg-background/72 pl-8 text-sm shadow-none lg:w-[250px]"
      />
    </div>
  ) : null;

  const facetNodes = shown.map((facet) => {
    const column = table.getColumn(facet.columnId);
    if (!column) return null;
    return (
      <DataTableFacetedFilter
        key={facet.columnId}
        column={column}
        title={facet.title}
        options={facet.options}
        onEmptyClose={
          revealed.has(facet.columnId)
            ? () =>
                setRevealed((current) => {
                  const next = new Set(current);
                  next.delete(facet.columnId);
                  return next;
                })
            : undefined
        }
      />
    );
  });

  const addFilterNode =
    hidden.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-facet-menu=""
            className="h-8 rounded-xl px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
            Filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48 rounded-xl border-border/45 bg-popover/95 shadow-lg"
        >
          <DropdownMenuLabel>Filter by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hidden.map((facet) => (
            <DropdownMenuItem
              key={facet.columnId}
              data-facet-menu-item={facet.columnId}
              onSelect={() => setRevealed((current) => new Set([...current, facet.columnId]))}
            >
              {facetTitle(facet)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const resetNode = isFiltered ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        table.resetColumnFilters();
        table.setGlobalFilter("");
        setRevealed(new Set());
      }}
      className="h-8 rounded-xl px-2.5"
    >
      Reset
      <X className="size-4" />
    </Button>
  ) : null;

  const filtersToggle = canCollapse ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-filters-toggle=""
      aria-expanded={showFilters}
      onClick={() => setFiltersOpen((current) => !current)}
      className={cn(
        "h-8 rounded-xl border-border/45 bg-background/65 shadow-none hover:bg-muted/26",
        activeFilters > 0 && "border-primary/30",
      )}
    >
      <SlidersHorizontal className="size-4" />
      Filters
      {activeFilters > 0 ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums">
          <span aria-hidden="true">{activeFilters}</span>
          <span className="sr-only">{activeFilters} active</span>
        </span>
      ) : null}
    </Button>
  ) : null;

  const rightGroup =
    actions || viewOptions || focusButton || filtersToggle ? (
      <div className="flex shrink-0 items-center gap-2">
        {filtersToggle}
        {actions}
        {viewOptions ? <DataTableViewOptions table={table} /> : null}
        {focusButton}
      </div>
    ) : null;

  if (!stacked) {
    return (
      <div className={cn("flex items-start gap-2", className)}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {searchNode}
          {facetNodes}
          {addFilterNode}
          {children}
          {resetNode}
        </div>
        {rightGroup ? <div className="ml-auto">{rightGroup}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        {searchNode}
        {rightGroup ? <div className="ml-auto">{rightGroup}</div> : null}
      </div>
      {showFilters ? (
        <div data-filter-row="" className="flex flex-wrap items-center gap-2">
          {facetNodes}
          {addFilterNode}
          {children}
          {resetNode}
        </div>
      ) : null}
    </div>
  );
}
