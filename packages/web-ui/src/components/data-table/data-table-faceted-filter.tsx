/**
 * One facet: a dashed "+ Title" button that opens a checklist of options
 * with live counts. Picking several options ORs them; the table ANDs the
 * facets. Options come from the data unless declared.
 */
import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, cn } from "@lykomi/web-primitives";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.tsx";
import {
  columnLabel,
  facetOptions,
  normalizeFacetValue,
  type DataTableFacetOption,
} from "./facets.ts";

export interface DataTableFacetedFilterProps<T> {
  column: Column<T, unknown>;
  title?: string;
  options?: DataTableFacetOption[];
  /** Show a search box inside the list once there are more options than this (default 7). */
  searchableFrom?: number;
  /** Called when the popover closes with nothing selected (a revealed facet goes back into the menu). */
  onEmptyClose?: () => void;
  className?: string;
}

export function DataTableFacetedFilter<T>({
  column,
  title,
  options: declared,
  searchableFrom = 7,
  onEmptyClose,
  className,
}: DataTableFacetedFilterProps<T>) {
  const [query, setQuery] = useState("");
  const label = title ?? columnLabel(column);
  const selected = normalizeFacetValue(column.getFilterValue());
  const selectedSet = new Set(selected);
  const options = facetOptions(column, declared);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  // A functional update, not one derived from this render's `selected`: with
  // URL-backed state the re-render lands a tick later, so two quick clicks
  // would otherwise both start from the same value and the first would be
  // lost.
  const toggle = (value: string) => {
    column.setFilterValue((current: unknown) => {
      const values = normalizeFacetValue(current);
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return next.length ? next : undefined;
    });
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) return;
        setQuery("");
        if (normalizeFacetValue(column.getFilterValue()).length === 0) onEmptyClose?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-facet={column.id}
          data-active={selected.length ? "" : undefined}
          className={cn(
            "border-dashed",
            selected.length && "border-solid border-primary/30",
            className,
          )}
        >
          <PlusCircle className="size-4" />
          {label}
          {selected.length > 0 ? (
            <>
              <span className="mx-0.5 h-4 w-px bg-border/60" aria-hidden="true" />
              {selected.length > 2 ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums">
                  <span aria-hidden="true">{selected.length}</span>
                  <span className="sr-only">{selected.length} selected</span>
                </span>
              ) : (
                options
                  .filter((option) => selectedSet.has(option.value))
                  .map((option) => (
                    <span
                      key={option.value}
                      title={option.label}
                      className="max-w-[8rem] truncate rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal"
                    >
                      {option.label}
                    </span>
                  ))
              )}
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {options.length >= searchableFrom ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={label}
            aria-label={`Search ${label} options`}
            className="mb-1 h-8 w-full rounded-lg border border-border/45 bg-background/72 px-2 text-sm outline-none focus:border-primary/30"
          />
        ) : null}
        <div
          role="group"
          aria-label={`${label} filter`}
          className="max-h-72 space-y-0.5 overflow-y-auto"
        >
          {shown.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">No options.</div>
          ) : (
            shown.map((option) => {
              const checked = selectedSet.has(option.value);
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    option.count === 0 && !checked && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border border-border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-60 [&_svg]:invisible",
                    )}
                  >
                    <Check className="size-3.5" />
                  </span>
                  {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 ? (
          <>
            <div className="my-1 h-px bg-border/45" />
            <button
              type="button"
              onClick={() => column.setFilterValue(undefined)}
              className="w-full rounded-lg px-2 py-1.5 text-center text-sm hover:bg-accent"
            >
              Clear filter
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
