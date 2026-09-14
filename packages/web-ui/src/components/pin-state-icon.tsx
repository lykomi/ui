import { Pin } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";

/** State glyph; controls retain explicit Pin/Unpin action labels. */
export function PinStateIcon({ pinned, className }: { pinned: boolean; className?: string }) {
  return (
    <Pin
      aria-hidden="true"
      className={cn(
        "size-4",
        pinned ? "text-primary fill-primary/20" : "rotate-45 text-muted-foreground fill-current/10",
        className,
      )}
    />
  );
}
