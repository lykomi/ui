import { AlertCircle } from "lucide-react";
import type { CSSProperties } from "react";
import type { NavItem } from "../lib/nav-config.ts";
import { NavLoadingSkeleton } from "./nav-loading-skeleton.tsx";

export function NavBranchStatus({
  item,
  bodyClassName,
  depth,
}: {
  item: NavItem;
  bodyClassName: string;
  depth: number;
}) {
  const iconClassName = "size-3.5 shrink-0";
  const geometry = { "--nav-depth": depth } as CSSProperties;
  const waiting = !item.disabled && item.childrenLoading && !item.children?.length;
  if (item.disabled) return null;
  if (item.childrenLoading) {
    // Refreshing a visible branch must not insert a row and move its items.
    // The branch remains aria-busy; pagination keeps its native disabled action.
    if (!waiting) return null;
    return <NavLoadingSkeleton depth={depth} bodyClassName={bodyClassName} />;
  }
  if (item.childrenError) {
    return (
      <div
        role="status"
        data-nav-branch-status
        data-nav-depth={depth}
        style={geometry}
        className={`flex w-full items-center gap-2 rounded-xl border border-transparent ${bodyClassName} pr-3 py-1 text-sm text-sidebar-foreground/60`}
      >
        <AlertCircle aria-hidden="true" className={iconClassName} />
        <span className="min-w-0">
          {item.childrenError}{" "}
          <button type="button" className="underline" onClick={() => item.onExpandedChange?.(true)}>
            Try again
          </button>
        </span>
      </div>
    );
  }
  return null;
}

export function NavBranchMore({ item }: { item: NavItem }) {
  if (item.disabled || !item.childrenHasMore || !item.onLoadMoreChildren) return null;
  return (
    <button
      type="button"
      disabled={item.childrenLoading}
      className="px-3 py-1 text-xs text-muted-foreground underline"
      onClick={item.onLoadMoreChildren}
    >
      Load more items
    </button>
  );
}
