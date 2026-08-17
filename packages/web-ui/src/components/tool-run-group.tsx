import { useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { ChevronRight, Loader2, CheckCircle2, XCircle, AlertCircle, Wrench } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";
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
 * OPEN by default: the detail is what a developer watching an agent work
 * actually wants, and a transcript that hides every step by default reads as
 * though nothing happened. Collapsing is the deliberate act, not expanding.
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
  const [isOpen, setIsOpen] = useState(true);

  const label = isRunning
    ? `Using ${total === 1 ? "1 tool" : `${total} tools`}…`
    : failed > 0
      ? `${total === 1 ? "1 tool" : `${total} tools`} · ${failed} failed`
      : `${total === 1 ? "1 tool" : `${total} tools`} · done`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full" data-tool-run-group>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-tool-run-trigger
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            allFailed && "text-destructive hover:text-destructive",
          )}
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
          />
          {isRunning ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : allFailed ? (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          ) : failed > 0 ? (
            // Partial: the run produced a result, some of it the hard way.
            <AlertCircle className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
          )}
          <Wrench className="size-3 shrink-0 opacity-60" />
          <span className="truncate">{label}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 flex flex-col gap-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * How many calls this run made, and how many of them failed.
 *
 * The group node the primitive hands us carries only the LAST part's status,
 * which is the wrong signal here: a run whose final call succeeded after an
 * earlier one failed would summarise as green. So read the parts themselves
 * and count. A failed tool call shows up two ways — a transport-level
 * `incomplete` status, or a `complete` round-trip whose payload describes an
 * error (a Python `@tool` raising, an MCP `isError`) — and both count.
 */
function useToolRunOutcome(indices: readonly number[]) {
  const parts = useAuiState((s) => s.message.parts) as
    | readonly { status?: { type?: string; reason?: string }; result?: unknown }[]
    | undefined;

  let failed = 0;
  for (const index of indices) {
    const part = parts?.[index];
    if (!part) continue;
    const status = part.status;
    if (status?.type === "incomplete" || _detectErrorResult(part.result)) failed++;
  }
  return { total: indices.length, failed };
}
