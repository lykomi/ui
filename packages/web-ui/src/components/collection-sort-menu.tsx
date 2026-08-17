import { ArrowUpDown, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { Button } from "@iloveagents/foundry-web-primitives";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface CollectionSortOption {
  value: string;
  label: string;
}

export function CollectionSortMenu({
  options,
  value,
  onValueChange,
  className,
}: {
  options: CollectionSortOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "rounded-xl border-border/45 bg-background/65 shadow-none hover:bg-muted/26",
            className,
          )}
        >
          <ArrowUpDown className="size-4" />
          <span>{active?.label ?? "Sort"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border-border/45 bg-popover/95 shadow-lg"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onValueChange(option.value)}
            className="flex items-center justify-between gap-3"
          >
            <span>{option.label}</span>
            <Check
              className={cn(
                "size-4 text-primary",
                value === option.value ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
