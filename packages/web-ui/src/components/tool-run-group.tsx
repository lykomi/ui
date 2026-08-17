import { useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { MessageDisclosure } from "./message-disclosure.tsx";
import { _detectErrorResult } from "./tool-fallback.tsx";
import type { ReactNode } from "react";

/**
 * One row standing in for a run of adjacent tool calls, with the cards under
 * it behind a disclosure.
 *
 * A turn that calls eight tools used to render eight bordered cards with no
 * way to fold them away. The run is now one summary line — "8 tools · done" —
 * over a group the reader can collapse when the machinery is in the way.
 *
 * COLLAPSED by default. This was open at first, on the reasoning that a
 * developer watching an agent work wants the detail — but in a real
 * transcript the cards dominate the answer they were supposed to support,
 * and the reader scrolls past machinery to reach the point. The summary line
 * already carries what matters at a glance (how many calls, and whether they
 * worked); opening it is the deliberate act.
 *
 * The row shape is shared with the reasoning part via `MessageDisclosure`, so
 * the two foldaways in a message read as one family instead of two widgets.
 *
 * RED only when the whole run failed. One failure among eight successful
 * calls is not a red turn — the agent recovered, and painting the summary red
 * would report a broken run where there was a working one. A partial failure
 * still says so, in the count, without the alarm.
 */
export function ToolRunGroup({
  indices,
  isRunning,
  children,
}: {
  indices: readonly number[];
  isRunning: boolean;
  children: ReactNode;
}) {
  const { total, failed } = useToolRunOutcome(indices);
  // Every call in the run failed — the only state that earns the alarm colour.
  const allFailed = total > 0 && failed === total;
  const [isOpen, setIsOpen] = useState(false);

  const label = isRunning
    ? `Using ${total === 1 ? "1 tool" : `${total} tools`}…`
    : failed > 0
      ? `${total === 1 ? "1 tool" : `${total} tools`} · ${failed} failed`
      : `${total === 1 ? "1 tool" : `${total} tools`} · done`;

  return (
    <MessageDisclosure
      open={isOpen}
      onOpenChange={setIsOpen}
      tone={allFailed ? "destructive" : "muted"}
      icon={
        isRunning ? (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        ) : allFailed ? (
          <XCircle className="size-3.5 text-destructive" />
        ) : failed > 0 ? (
          // Partial: the run produced a result, some of it the hard way.
          <AlertCircle className="size-3.5 text-muted-foreground" />
        ) : (
          <CheckCircle2 className="size-3.5 text-primary" />
        )
      }
      label={label}
      data-tool-run-group
    >
      <div className="flex flex-col gap-2">{children}</div>
    </MessageDisclosure>
  );
}

function useToolRunOutcome(indices: readonly number[]) {
  const parts = useAuiState((s) => s.message.parts) as
    readonly { status?: { type?: string; reason?: string }; result?: unknown }[] | undefined;

  let failed = 0;
  for (const index of indices) {
    const part = parts?.[index];
    if (!part) continue;
    const status = part.status;
    if (status?.type === "incomplete" || _detectErrorResult(part.result)) failed++;
  }
  return { total: indices.length, failed };
}
