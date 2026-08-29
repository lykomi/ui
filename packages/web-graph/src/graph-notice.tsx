import { AlertTriangle, Network } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import type { GraphModelLoss } from "./use-graph-model.ts";

/** Shown in place of the canvas when there is nothing to draw. */
export function GraphEmptyState({ message, className }: { message?: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
    >
      <Network className="size-6 opacity-50" aria-hidden="true" />
      <p className="text-sm">{message ?? "No graph data to display."}</p>
    </div>
  );
}

/**
 * Say what was withheld, and why.
 *
 * A graph that silently renders 1,500 of 40,000 nodes is worse than one that
 * refuses to render: the user reads the picture as the whole answer. Each
 * cause is named separately because the fixes differ — a cap means "narrow the
 * query", dangling edges mean "the projection is incomplete".
 */
export function GraphLossNotice({
  loss,
  truncatedByProducer,
  className,
}: {
  loss: GraphModelLoss;
  truncatedByProducer?: boolean;
  className?: string;
}) {
  const reasons: string[] = [];
  if (truncatedByProducer) reasons.push("the query hit the server's result cap");
  if (loss.cappedNodes > 0) reasons.push(`${loss.cappedNodes} nodes over the render limit`);
  if (loss.cappedEdges > 0) reasons.push(`${loss.cappedEdges} relationships over the render limit`);
  if (loss.danglingEdges > 0) {
    reasons.push(`${loss.danglingEdges} relationships whose endpoints weren't returned`);
  }
  if (reasons.length === 0) return null;

  return (
    <p
      role="status"
      className={cn(
        "text-muted-foreground flex items-start gap-1.5 text-xs",
        className,
      )}
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>Showing a partial graph — {reasons.join("; ")}.</span>
    </p>
  );
}
