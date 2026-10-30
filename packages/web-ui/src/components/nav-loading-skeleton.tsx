import type { CSSProperties } from "react";

/** Loading rows use the same depth and pointer geometry as real navigation. */
export function NavLoadingSkeleton({
  rows = 3,
  depth = 0,
  bodyClassName = "pl-8",
  compact = false,
}: {
  rows?: number;
  depth?: number;
  bodyClassName?: string;
  compact?: boolean;
}) {
  return (
    <div role="status" aria-label="Loading navigation" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          data-nav-branch-status
          data-nav-depth={depth}
          style={{ "--nav-depth": depth } as CSSProperties}
          aria-hidden="true"
          className={`flex min-h-8 w-full items-center gap-2 border border-transparent py-1 pr-3 ${compact ? "justify-center px-3" : bodyClassName}`}
        >
          <span className="size-3.5 shrink-0 rounded bg-sidebar-accent motion-safe:animate-pulse" />
          {!compact && (
            <span
              className={`h-3 rounded bg-sidebar-accent motion-safe:animate-pulse ${index % 2 ? "w-1/2" : "w-2/3"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
