import { cn } from "@iloveagents/foundry-web-primitives";
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
export function GraphTable({ model, styleMap, onSelectNode, className }: GraphTableProps) {
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
            const degree = model.links.filter(
              (link) => link.source === node.id || link.target === node.id,
            ).length;
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
