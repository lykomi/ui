import { useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { MessageDisclosure } from "./message-disclosure.tsx";
import { _detectErrorResult } from "./tool-fallback.tsx";
import type { ReactNode } from "react";

/**
 * ONE row for everything a turn did before it answered.
 *
 * A turn that searched a corpus eleven times used to render eleven summary
 * rows — one per adjacent run of tool calls — plus a reasoning row of its
 * own, and the answer somewhere underneath. Each row was individually
 * reasonable; stacked, they were a ladder the reader had to climb past to
 * reach the point.
 *
 * So the machinery folds: "Worked · 20 tools · reasoning". The model's PROSE
 * never goes inside — it is what the reader came for and it stays in the
 * open, which also means each stretch of it ends one of these rows and
 * starts the next. A turn that narrates its steps gets one row per step
 * rather than one per tool run; a turn that just works and answers gets
 * exactly one.
 *
 * Order is CHRONOLOGICAL, inside the fold and outside it. Reasoning explains
 * why the next call happened ("I need the termination clause from both
 * agreements" → three searches); moving it away from the calls it explains
 * turns a narrative into a pile. Outside, a multi-step turn reads as work,
 * what it learned, work, what it learned, answer — the model's prose ends
 * one of these rows and starts the next.
 *
 * Collapsed by default, for the reason the per-run fold this replaces had
 * already found: in a real transcript the machinery dominates the answer it
 * was meant to support, and the reader scrolls past it to reach the point.
 */
export function TurnActivity({
  indices,
  isRunning,
  children,
}: {
  indices: readonly number[];
  isRunning: boolean;
  children: ReactNode;
}) {
  const { tools, failed, hasReasoning } = useTurnOutcome(indices);
  const [isOpen, setIsOpen] = useState(false);
  const summary = summarise({ tools, failed, hasReasoning, isRunning });

  // Red only when EVERY call failed AND the turn has SETTLED. One failure
  // among twenty is a turn that recovered, and painting it red would report a
  // broken answer where there is a working one — but so would painting it red
  // mid-run, when the only calls so far happen to have failed and the model is
  // still reasoning its way to one that works. A partial failure still says
  // so, in the count, without the alarm.
  const allFailed = !isRunning && tools > 0 && failed === tools;

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
          <AlertCircle className="size-3.5 text-muted-foreground" />
        ) : (
          <CheckCircle2 className="size-3.5 text-primary" />
        )
      }
      label={summary}
      // The summary goes in the accessible name, not just the visible one.
      // An `aria-label` REPLACES the name a button would otherwise derive
      // from its contents, so a bare "Show what this turn did" would have
      // announced the row while hiding the very thing it summarises — the
      // call count, whether anything failed, whether there is thinking to
      // read. A screen-reader user got strictly less than a sighted one.
      ariaLabel={`${summary} — ${isOpen ? "hide" : "show"} details`}
      data-turn-activity
    >
      <div className="flex flex-col gap-2">{children}</div>
    </MessageDisclosure>
  );
}

/**
 * The row's one line of text.
 *
 * Says what happened, in the order a reader asks it: is it still going, how
 * much work was there, did any of it fail, and was there thinking to read.
 * "Worked" alone when a turn only thought — claiming tools it never called
 * would be a lie in the summary line, which is the one part nobody expands
 * to check.
 *
 * This row describes its CONTENTS; it does not narrate the run. The phase a
 * run is in belongs to the status indicator above the composer, which knows
 * things this row cannot — which tool is in flight, whether the stream has
 * stalled. A turn with reasoning and no calls yet therefore says "Reasoning"
 * rather than "Thinking…", which is what the indicator is already saying two
 * lines below; the same word twice on one screen reads as a stutter, not as
 * two facts.
 *
 * No ellipses either: the spinner in the row's own icon slot carries "still
 * going", and it does it without competing for the label.
 */
function summarise({
  tools,
  failed,
  hasReasoning,
  isRunning,
}: {
  tools: number;
  failed: number;
  hasReasoning: boolean;
  isRunning: boolean;
}): string {
  const toolText = tools === 1 ? "1 tool" : `${tools} tools`;
  // 0 tools while running means the group holds nothing but reasoning —
  // `useTurnOutcome` counts every non-reasoning part as a call — so naming it
  // is accurate, not a guess.
  if (isRunning) return tools > 0 ? `Working · ${toolText}` : "Reasoning";

  const parts = ["Worked"];
  if (tools > 0) parts.push(failed > 0 ? `${toolText} · ${failed} failed` : toolText);
  if (hasReasoning) parts.push("reasoning");
  return parts.join(" · ");
}

/** What the turn actually contains, read from the message's own parts. */
function useTurnOutcome(indices: readonly number[]) {
  const parts = useAuiState((s) => s.message.parts) as
    | readonly {
        type?: string;
        status?: { type?: string; reason?: string };
        result?: unknown;
      }[]
    | undefined;

  let tools = 0;
  let failed = 0;
  let hasReasoning = false;
  for (const index of indices) {
    const part = parts?.[index];
    if (!part) continue;
    if (part.type === "reasoning") {
      hasReasoning = true;
      continue;
    }
    // Anything else under this node is a call the turn made. Counted by
    // exclusion rather than by an allow-list of type names, so a new tool
    // part type shows up in the count instead of vanishing from it.
    tools++;
    if (part.status?.type === "incomplete" || _detectErrorResult(part.result)) failed++;
  }
  return { tools, failed, hasReasoning };
}
