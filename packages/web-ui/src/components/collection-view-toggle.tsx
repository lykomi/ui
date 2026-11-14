import { LayoutGrid, Rows3, TableProperties } from "lucide-react";

import { Button } from "@lykomi/web-primitives";
import { cn } from "@lykomi/web-primitives";

export type CollectionViewMode = "table" | "grid" | "tiles";

const VIEW_OPTIONS: Array<{
  value: CollectionViewMode;
  label: string;
  icon: typeof TableProperties;
}> = [
  { value: "table", label: "Table", icon: TableProperties },
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "tiles", label: "Tiles", icon: Rows3 },
];

export function CollectionViewToggle({
  value,
  onValueChange,
  views = ["table", "grid"],
  className,
}: {
  value: CollectionViewMode;
  onValueChange: (value: CollectionViewMode) => void;
  views?: CollectionViewMode[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl bg-muted/26 p-1 ring-1 ring-border/40",
        className,
      )}
    >
      {VIEW_OPTIONS.filter((option) => views.includes(option.value)).map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            aria-label={option.label}
            variant={active ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-lg px-2.5 text-muted-foreground hover:bg-background/70 hover:text-foreground",
              active &&
                "bg-background text-foreground ring-1 ring-primary/35 shadow-[0_1px_2px_rgb(15_23_42/0.08)] hover:bg-background",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sr-only sm:hidden">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
