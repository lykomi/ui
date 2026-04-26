import { cn } from "@lastspace/web-primitives";

import type { CollectionViewMode } from "./collection-view-toggle.tsx";

export function CollectionSkeleton({
  view,
  rows = 8,
  className,
}: {
  view: CollectionViewMode;
  rows?: number;
  className?: string;
}) {
  if (view === "table") {
    return (
      <div className={cn("overflow-hidden rounded-[1.5rem] bg-background/65 ring-1 ring-border/35", className)}>
        <div className="grid grid-cols-4 gap-4 border-b border-border/40 bg-muted/28 px-5 py-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-3.5 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="divide-y divide-border/35">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 px-5 py-4">
              {Array.from({ length: 4 }).map((_, cellIndex) => (
                <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted/80" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        view === "tiles"
          ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]"
          : "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]",
        className,
      )}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "animate-pulse rounded-[1.5rem] bg-card/80 ring-1 ring-border/35",
            view === "tiles" ? "h-28" : "h-40",
          )}
        />
      ))}
    </div>
  );
}
