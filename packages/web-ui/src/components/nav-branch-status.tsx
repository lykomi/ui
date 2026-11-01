import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import { type CSSProperties, useState } from "react";
import type { NavItem } from "../lib/nav-config.ts";

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
  if (item.disabled) return null;
  if (item.childrenLoading) {
    // The answer can be empty. Keep loading in the existing disclosure slot,
    // rather than inserting pretend children that disappear on an empty read.
    // The branch remains aria-busy; pagination keeps its native busy action.
    return null;
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

export function NavBranchMore({ item, bodyClassName }: { item: NavItem; bodyClassName: string }) {
  const [focused, setFocused] = useState(false);
  if (item.disabled || (!focused && (!item.childrenHasMore || !item.onLoadMoreChildren)))
    return null;
  const waiting = Boolean(item.childrenLoading);
  const available = Boolean(item.childrenHasMore && item.onLoadMoreChildren) && !waiting;
  const label =
    item.childrenHasMore || waiting
      ? "Load more items"
      : item.childrenError
        ? "More items unavailable"
        : "All items loaded";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-disabled={!available || undefined}
      aria-label={`${label} in ${item.label}`}
      aria-busy={waiting || undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        "w-full justify-start text-sidebar-foreground/70 aria-disabled:opacity-50",
        bodyClassName,
      )}
      onClick={() => {
        if (available) item.onLoadMoreChildren?.();
      }}
    >
      {waiting ? (
        <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
      ) : item.childrenHasMore ? (
        <ChevronDown aria-hidden="true" className="size-3.5" />
      ) : (
        <Check aria-hidden="true" className="size-3.5" />
      )}
      {label}
    </Button>
  );
}
