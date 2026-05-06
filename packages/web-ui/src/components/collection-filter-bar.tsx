import { Check, Filter, X } from "lucide-react";

import { Button } from "@iloveagents/foundry-web-primitives";
import { Checkbox } from "@iloveagents/foundry-web-primitives";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";
import { cn } from "@iloveagents/foundry-web-primitives";

export type CollectionFilterValue = string | string[] | boolean | undefined;

export interface CollectionFilterOption {
  value: string;
  label: string;
}

export interface CollectionFilterDefinition {
  key: string;
  label: string;
  type: "single" | "multi" | "boolean";
  options?: CollectionFilterOption[];
  trueLabel?: string;
}

function activeCount(value: CollectionFilterValue, type: CollectionFilterDefinition["type"]) {
  if (type === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.length;
  return value ? 1 : 0;
}

export function CollectionFilterBar({
  filters,
  values,
  onValueChange,
  onClearAll,
  className,
}: {
  filters: CollectionFilterDefinition[];
  values: Record<string, CollectionFilterValue>;
  onValueChange: (key: string, value: CollectionFilterValue) => void;
  onClearAll?: () => void;
  className?: string;
}) {
  const hasActiveFilters = filters.some((filter) => activeCount(values[filter.key], filter.type) > 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => {
        const count = activeCount(values[filter.key], filter.type);
        return (
          <Popover key={filter.key}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-xl border-border/45 bg-background/65 shadow-none hover:bg-muted/26",
                  count > 0 && "border-primary/18 bg-primary/7 text-foreground hover:bg-primary/10",
                )}
              >
                <Filter className="size-4" />
                <span>{filter.label}</span>
                {count > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    {count}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 rounded-2xl border-border/45 bg-popover/95 p-2 shadow-lg">
              <div className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {filter.label}
              </div>
              {filter.type === "boolean" ? (
                <button
                  type="button"
                  onClick={() => onValueChange(filter.key, values[filter.key] ? undefined : true)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    values[filter.key] ? "bg-primary/8 text-foreground" : "hover:bg-accent",
                  )}
                >
                  <Checkbox checked={Boolean(values[filter.key])} />
                  <span>{filter.trueLabel ?? `Only ${filter.label.toLowerCase()}`}</span>
                </button>
              ) : null}
              {filter.type === "single" ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => onValueChange(filter.key, undefined)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span>Any</span>
                    <Check
                      className={cn(
                        "size-4 text-primary",
                        values[filter.key] == null ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                  {filter.options?.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onValueChange(filter.key, option.value)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span>{option.label}</span>
                      <Check
                        className={cn(
                          "size-4 text-primary",
                          values[filter.key] === option.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              {filter.type === "multi" ? (
                <div className="space-y-1">
                  {filter.options?.map((option) => {
                    const current = Array.isArray(values[filter.key])
                      ? (values[filter.key] as string[])
                      : [];
                    const checked = current.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onValueChange(
                            filter.key,
                            checked
                              ? current.filter((item: string) => item !== option.value)
                              : [...current, option.value],
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                          checked ? "bg-primary/8 text-foreground" : "hover:bg-accent",
                        )}
                      >
                        <Checkbox checked={checked} />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
        );
      })}
      {hasActiveFilters && onClearAll ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="rounded-xl text-muted-foreground hover:bg-muted/26"
        >
          <X className="size-4" />
          <span>Clear</span>
        </Button>
      ) : null}
    </div>
  );
}
