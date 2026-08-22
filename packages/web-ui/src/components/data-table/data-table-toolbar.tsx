/**
 * Search + facets + Reset on the left, actions + View menu on the right.
 *
 * Many facets stay calm: only the *pinned* ones (explicit `pinned`, else the
 * first `pinnedFacets`) are always visible; the rest wait behind one
 * "+ Filter" menu and appear as a facet button once chosen or active. So
 * row one holds search, a few facets, "+ Filter" and the actions, and a
 * filter the user added reads as a chip in the same row.
 */
import type { Table } from "@tanstack/react-table";
import { ListFilter, Maximize2, Minimize2, Search, X } from "lucide-react";
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

export interface DataTableToolbarProps<T> {
  table: Table<T>;
  facets?: DataTableFacet[];
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
  const isFiltered = state.columnFilters.length > 0 || Boolean(state.globalFilter);
  const { shown, hidden } = visibleFacets(table, facets, revealed, pinnedFacets);
  const facetTitle = (facet: DataTableFacet) => {
    const column = table.getColumn(facet.columnId);
    return facet.title ?? (column ? columnLabel(column) : facet.columnId);
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search ? (
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
      ) : null}
      {shown.map((facet) => {
        const column = table.getColumn(facet.columnId);
        if (!column) return null;
        return (
          <DataTableFacetedFilter
            key={facet.columnId}
            column={column}
            title={facet.title}
            options={facet.options}
          />
        );
      })}
      {hidden.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-facet-menu=""
              className="h-8 rounded-xl px-2.5 text-muted-foreground hover:text-foreground"
            >
              <ListFilter className="size-4" />
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
      ) : null}
      {children}
      {isFiltered ? (
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
      ) : null}
      {actions || viewOptions || focusButton ? (
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {viewOptions ? <DataTableViewOptions table={table} /> : null}
          {focusButton}
        </div>
      ) : null}
    </div>
  );
}
