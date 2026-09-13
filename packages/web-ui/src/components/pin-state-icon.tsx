import { Pin } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";

/** State glyph; controls retain explicit Pin/Unpin action labels. */
export function PinStateIcon({ pinned, className }: { pinned: boolean; className?: string }) {
  return (
    <Pin
      aria-hidden="true"
      className={cn(
        "size-4",
        pinned ? "text-foreground fill-muted-foreground/40" : "text-muted-foreground",
        className,
      )}
    />
  );
}
