import { cn } from "@iloveagents/foundry-web-primitives";
import { useMemo } from "react";
import { primaryLabel, type GraphNode } from "./model.ts";
import type { GraphModel } from "./use-graph-model.ts";
import type { GraphStyleMap } from "./use-graph-styling.ts";

export interface GraphTableProps {
  model: GraphModel;
  styleMap: GraphStyleMap;
  onSelectNode?: (node: GraphNode) => void;
  className?: string;
}

/**
 * The same graph as a table.
 *
 * This is the accessible surface, not a developer escape hatch: a `<canvas>` is
 * opaque to a screen reader, so without this the graph is simply unavailable to
 * anyone using one. It is also what renders when there is no canvas at all —
 * jsdom in tests, and print.
 */
/** force-graph swaps an endpoint id for the node object once it has run. */
function endpointId(end: unknown): string | undefined {
  if (typeof end === "string") return end;
  if (typeof end === "number") return String(end);
  if (typeof end === "object" && end !== null && "id" in end) {
    const id = (end as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return undefined;
}

export function GraphTable({ model, styleMap, onSelectNode, className }: GraphTableProps) {
  // Counted once, not per row. The old version filtered the whole link array
  // for every node — quadratic, and this is the ACCESSIBILITY path, where a
  // capped graph can still carry 1,500 nodes and 3,000 edges.
  //
  // Endpoints are read through a helper because force-graph replaces the ids
  // with the node objects once it has run: after a canvas render, comparing
  // against `node.id` would silently give every row a degree of zero.
  const degrees = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (id: string | undefined) => {
      if (id === undefined) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    };
    for (const link of model.links) {
      bump(endpointId(link.source));
      bump(endpointId(link.target));
    }
    return counts;
  }, [model.links]);

  return (
    <div className={cn("overflow-auto", className)}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">
          {model.nodes.length} nodes and {model.links.length} relationships
        </caption>
        <thead className="text-muted-foreground sticky top-0">
          <tr className="border-border bg-card border-b">
            <th scope="col" className="px-2 py-1 font-medium">
              Label
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Caption
            </th>
            <th scope="col" className="px-2 py-1 font-medium">
              Relationships
            </th>
          </tr>
        </thead>
        <tbody>
          {model.nodes.map((node) => {
            const degree = degrees.get(node.id) ?? 0;
            return (
              <tr key={node.id} className="border-border/60 border-b last:border-0">
                <td className="text-muted-foreground px-2 py-1">{primaryLabel(node)}</td>
                <td className="px-2 py-1">
                  {onSelectNode ? (
                    <button
                      type="button"
                      onClick={() => onSelectNode(node)}
                      className="focus-visible:ring-ring rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1"
                    >
                      {styleMap.styleForNode(node).caption}
                    </button>
                  ) : (
                    styleMap.styleForNode(node).caption
                  )}
                </td>
                <td className="text-muted-foreground px-2 py-1 tabular-nums">{degree}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
