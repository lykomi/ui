import { useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";
import { _detectErrorResult } from "./tool-fallback.tsx";
import type { ReactNode } from "react";

/**
 * One collapsed row standing in for a run of adjacent tool calls.
 *
 * A turn that calls eight tools used to render eight bordered cards, pushing
 * the answer off-screen and burying it in machinery most readers do not want.
 * The transcript now shows what happened — "8 tools · done", or the failure
 * count when something broke — and keeps the cards themselves one click away
 * for whoever is debugging.
 *
 * Collapsed is the default even for a single call, so the transcript reads the
 * same whether a turn used one tool or ten. Failures are the exception: a run
 * containing an error opens itself, because a red summary the reader has to
 * click to understand is worse than no summary at all.
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
  // `useState` initialiser, not an effect: opening on failure is the row's
  // starting state, not a correction applied after a frame of showing the
  // wrong one. Once open, the reader's own toggling wins.
  const [isOpen, setIsOpen] = useState(failed > 0);

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
            failed > 0 && "text-destructive hover:text-destructive",
          )}
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
          />
          {isRunning ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : failed > 0 ? (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
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
