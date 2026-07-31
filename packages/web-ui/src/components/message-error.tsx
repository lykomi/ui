import type { FC } from "react";
import { MessagePrimitive, ErrorPrimitive } from "@assistant-ui/react";
import { cn } from "@iloveagents/foundry-web-primitives";

/**
 * Visible, styled run-error for an assistant message — rendered whenever the
 * message settled with an error status (agent RUN_ERROR, lost connection,
 * transport failure). Shared by the full-page thread and the compact chat
 * bubble so a failed run is NEVER silent in either surface.
 */
export const MessageError: FC<{ compact?: boolean }> = ({ compact }) => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root
      className={cn(
        "mt-2 rounded-lg border border-destructive bg-destructive/10",
        compact ? "p-2" : "p-3",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-medium text-destructive", compact ? "text-xs" : "text-sm")}>
          Error:
        </span>
        <ErrorPrimitive.Message
          className={cn("text-destructive", compact ? "text-xs" : "text-sm")}
        />
      </div>
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);
