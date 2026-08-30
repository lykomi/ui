import { useState } from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { primaryLabel, safeStringify, type GraphPayload } from "../model.ts";

/** Rows the producer put in `meta` when a query returned scalars, not a graph. */
type MetaRows = Record<string, unknown>[];

interface GraphProvenanceProps {
  payload: GraphPayload;
  /** Arguments the agent called the tool with — usually where the query lives. */
  args?: unknown;
  className?: string;
}

function readString(source: unknown, key: string): string | null {
  if (typeof source !== "object" || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * What the card shows when expanded: the query that ran, and the result.
 *
 * The card is provenance, not a viewport — the graph belongs in the panel,
 * where it has room. What someone opens a tool card for is "what did it
 * actually do, and do I believe it": the statement, the shape of what came
 * back, and a way to see the data itself.
 */
export function GraphProvenance({ payload, args, className }: GraphProvenanceProps) {
  const [showRaw, setShowRaw] = useState(false);
  const query =
    readString(payload.meta, "query") ?? readString(args, "cypher") ?? readString(args, "query");
  const elapsed = typeof payload.meta?.elapsedMs === "number" ? payload.meta.elapsedMs : null;
  const database = readString(payload.meta, "database");
  const rows = Array.isArray(payload.meta?.rows) ? (payload.meta.rows as MetaRows) : null;

  const labelCounts = new Map<string, number>();
  for (const node of payload.nodes) {
    const label = primaryLabel(node);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return (
    <div className={cn("space-y-2 text-xs", className)}>
      {query && (
        <section>
          <h4 className="text-muted-foreground mb-1 font-medium">Query</h4>
          <pre className="border-border bg-muted/60 text-foreground max-h-40 overflow-auto rounded border p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {query}
          </pre>
        </section>
      )}

      <section>
        <h4 className="text-muted-foreground mb-1 font-medium">Result</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-foreground">
            {payload.nodes.length} nodes · {payload.edges.length} relationships
          </span>
          {[...labelCounts].map(([label, count]) => (
            <span key={label} className="text-muted-foreground">
              {label} {count}
            </span>
          ))}
          {payload.truncated && (
            <span className="text-muted-foreground">truncated at the server's cap</span>
          )}
          {elapsed !== null && <span className="text-muted-foreground">{elapsed} ms</span>}
          {database && <span className="text-muted-foreground">db: {database}</span>}
        </div>
      </section>

      {rows && rows.length > 0 && (
        <section>
          {/* A query that returned scalars has no graph to open — showing the
              values here is the difference between an answer and a dead end. */}
          <h4 className="text-muted-foreground mb-1 font-medium">Rows</h4>
          <pre className="border-border bg-muted/60 text-foreground max-h-40 overflow-auto rounded border p-2 font-mono text-[11px]">
            {safeStringify(rows, 2)}
          </pre>
        </section>
      )}

      <button
        type="button"
        onClick={() => setShowRaw((open) => !open)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1"
      >
        {showRaw ? "Hide raw result" : "Show raw result"}
      </button>
      {showRaw && (
        <pre className="border-border bg-muted/60 text-foreground max-h-64 overflow-auto rounded border p-2 font-mono text-[11px]">
          {safeStringify(payload, 2)}
        </pre>
      )}
    </div>
  );
}
