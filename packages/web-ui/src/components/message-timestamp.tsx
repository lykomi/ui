import type { FC } from "react";
import { useAuiState } from "@assistant-ui/react";
import { cn } from "@iloveagents/foundry-web-primitives";

/**
 * Message send/receive time — revealed on hover in the same row as the
 * message actions (edit / copy). The short time is shown; the full date
 * lives in the native tooltip. Shared by the full-page thread and the
 * compact chat bubble.
 */
export const MessageTimestamp: FC<{ className?: string }> = ({ className }) => {
  const createdAt = useAuiState((s) => s.message.createdAt);
  if (!createdAt) return null;
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <span
      title={d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      className={cn(
        "text-xs text-muted-foreground/70 tabular-nums select-none",
        "opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
};
