import { LoaderCircle } from "lucide-react";
import type { NavItem } from "../lib/nav-config.ts";

export function NavBranchStatus({ item }: { item: NavItem }) {
  if (item.disabled) return null;
  if (item.childrenLoading) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground"
      >
        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
        Loading items…
      </div>
    );
  }
  if (item.childrenError) {
    return (
      <div role="status" className="px-3 py-1 text-xs text-muted-foreground">
        <span>{item.childrenError}</span>{" "}
        <button type="button" className="underline" onClick={() => item.onExpandedChange?.(true)}>
          Try again
        </button>
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
