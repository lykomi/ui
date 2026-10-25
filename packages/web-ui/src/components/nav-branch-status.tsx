import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { NavItem } from "../lib/nav-config.ts";

export function NavBranchStatus({ item, bodyClassName }: { item: NavItem; bodyClassName: string }) {
  const waiting = !item.disabled && item.childrenLoading && !item.children?.length;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, [waiting]);
  if (item.disabled) return null;
  if (item.childrenLoading) {
    // Refreshing a visible branch must not insert a row and move its items.
    // The branch remains aria-busy; pagination keeps its native disabled action.
    if (!waiting || !visible) return null;
    return (
      <div
        role="status"
        className={`flex w-full items-center gap-2 rounded-xl border border-transparent ${bodyClassName} pr-3 py-1 text-sm text-sidebar-foreground/60 animate-in fade-in duration-150 motion-reduce:animate-none`}
      >
        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
        Loading items…
      </div>
    );
  }
  if (item.childrenError) {
    return (
      <div
        role="status"
        className={`rounded-xl border border-transparent ${bodyClassName} pr-3 py-1 text-sm text-sidebar-foreground/60`}
      >
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
