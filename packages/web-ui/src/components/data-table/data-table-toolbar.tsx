/**
 * Search + facets + Reset on the left, actions + View menu on the right.
 * Facets are declared by column id; everything else is read off the table.
 */
import type { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Input, cn } from "@iloveagents/foundry-web-primitives";
import { DataTableFacetedFilter } from "./data-table-faceted-filter.tsx";
import { DataTableViewOptions } from "./data-table-view-options.tsx";
import type { DataTableFacetOption } from "./facets.ts";

export interface DataTableFacet {
  columnId: string;
  title?: string;
  options?: DataTableFacetOption[];
}

export interface DataTableToolbarProps<T> {
  table: Table<T>;
  facets?: DataTableFacet[];
  searchPlaceholder?: string;
  /** Hide the search box. */
  search?: boolean;
  /** Hide the View (column visibility) menu. */
  viewOptions?: boolean;
  /** Extra controls rendered next to the facets (left side). */
  children?: ReactNode;
  /** Controls rendered on the right, before the View menu. */
  actions?: ReactNode;
  className?: string;
}

export function DataTableToolbar<T>({
  table,
  facets = [],
  searchPlaceholder = "Search…",
  search = true,
  viewOptions = true,
  children,
  actions,
  className,
}: DataTableToolbarProps<T>) {
  const state = table.getState();
  const isFiltered = state.columnFilters.length > 0 || Boolean(state.globalFilter);
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
      {facets.map((facet) => {
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
      {children}
      {isFiltered ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            table.resetColumnFilters();
            table.setGlobalFilter("");
          }}
          className="h-8 rounded-xl px-2.5"
        >
          Reset
          <X className="size-4" />
        </Button>
      ) : null}
      {actions || viewOptions ? (
        <div className="ml-auto flex items-center gap-2">
          {actions}
          {viewOptions ? <DataTableViewOptions table={table} /> : null}
        </div>
      ) : null}
    </div>
  );
}
