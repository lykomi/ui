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
 * So the machinery folds once, at the turn: "Worked · 20 tools · reasoning".
 * The ANSWER never goes inside — it is what the reader came for and it stays
 * in the open, below.
 *
 * Order inside the fold is CHRONOLOGICAL, deliberately. Reasoning explains
 * why the next call happened ("I need the termination clause from both
 * agreements" → three searches); reordering it away from the calls it
 * explains turns a narrative into a pile. Outside the fold the old ordering
 * argument still holds — machinery first, answer last — and that is the
 * ANSWER's doing: the text part is ordered last, so this row needs no
 * reordering of its own.
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

  // Red only when EVERY call failed. One failure among twenty is a turn that
  // recovered, and painting it red would report a broken answer where there
  // is a working one. A partial failure still says so, in the count, without
  // the alarm.
  const allFailed = tools > 0 && failed === tools;

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
      label={summarise({ tools, failed, hasReasoning, isRunning })}
      // Deliberately the DEFAULT placement, not `after-tools`. That placement
      // exists to move a reasoning row below the tool runs it explains — a
      // reordering that is now internal to this fold, so claiming it here
      // would only opt the row out of the rule that compacts adjacent rows.
      // The answer still lands last because the text part is ordered, not
      // because this row is.
      ariaLabel={isOpen ? "Hide what this turn did" : "Show what this turn did"}
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
  if (isRunning) return tools > 0 ? `Working · ${toolText}…` : "Thinking…";

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
