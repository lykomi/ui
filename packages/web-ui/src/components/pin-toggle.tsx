import type { ComponentProps } from "react";
import { PinStateIcon } from "./pin-state-icon.tsx";
import { Button, cn } from "@iloveagents/foundry-web-primitives";

/** Pinned glyphs are upright; unpinned glyphs tilt. Labels describe the action. */
export function PinToggle({
  pinned,
  label,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & { pinned: boolean; label: string }) {
  const action = `${pinned ? "Unpin" : "Pin"} ${label}`;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={action}
      aria-pressed={pinned}
      title={action}
      {...props}
      className={cn(
        "shrink-0 shadow-none",
        pinned ? "text-primary hover:text-primary" : "text-muted-foreground",
        className,
      )}
    >
      <PinStateIcon pinned={pinned} />
    </Button>
  );
}
