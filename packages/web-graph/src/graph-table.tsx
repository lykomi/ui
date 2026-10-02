import { cn } from "@iloveagents/foundry-web-primitives";
import { useMemo } from "react";
import { primaryLabel, type GraphEdge, type GraphNode } from "./model.ts";
import { endpointId, type GraphModel } from "./use-graph-model.ts";
import { describeEdge, type GraphStyleMap } from "./use-graph-styling.ts";

export interface GraphTableProps {
  model: GraphModel;
  styleMap: GraphStyleMap;
  onSelectNode?: (node: GraphNode) => void;
  /**
   * Open a relationship in the inspector.
   *
   * The drawer has always handled edges; only the canvas could reach them.
   * This table IS the accessibility surface — the canvas is one opaque element
   * to a screen reader — so without this a keyboard user could read that a
   * relationship exists and never see a single one of its properties, while a
   * mouse user clicks the same line and gets all of them.
   */
  onSelectEdge?: (edge: GraphEdge) => void;
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
export function GraphTable({
  model,
  styleMap,
  onSelectNode,
  onSelectEdge,
  className,
}: GraphTableProps) {
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

  // The relationships, resolved to the captions the nodes are listed under.
  // A degree count says a node is connected; it does not say to WHAT, by which
  // type, or in which direction — which is the whole content of a graph. A
  // screen-reader user reading only the node table could not tell two
  // completely different graphs apart.
  const captionFor = useMemo(() => {
    const byId = new Map(model.nodes.map((node) => [node.id, styleMap.styleForNode(node).caption]));
    return (id: string | undefined) => (id === undefined ? "—" : (byId.get(id) ?? id));
  }, [model.nodes, styleMap]);

  return (
    <div className={cn("flex flex-col gap-4 overflow-auto", className)}>
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">
          Nodes: {model.nodes.length} of them, in a graph with {model.links.length} relationships
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
                <td className="text-muted-foreground px-2 py-1" title={primaryLabel(node)}>
                  {styleMap.nameForLabel(primaryLabel(node))}
                </td>
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

      {model.links.length > 0 && (
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Relationships: {model.links.length} of them, as source, type and target
            {onSelectEdge ? "; the type opens its properties" : ""}
          </caption>
          <thead className="text-muted-foreground sticky top-0">
            <tr className="border-border bg-card border-b">
              <th scope="col" className="px-2 py-1 font-medium">
                From
              </th>
              <th scope="col" className="px-2 py-1 font-medium">
                Type
              </th>
              <th scope="col" className="px-2 py-1 font-medium">
                To
              </th>
            </tr>
          </thead>
          <tbody>
            {model.links.map((link) => (
              <tr key={link.id} className="border-border/60 border-b last:border-0">
                <td className="px-2 py-1">{captionFor(endpointId(link.source))}</td>
                <td className="text-muted-foreground px-2 py-1">
                  {onSelectEdge ? (
                    <button
                      type="button"
                      // Endpoints normalised for the same reason
                      // `getViewState` normalises them: force-graph swaps a
                      // link\'s `source`/`target` for the node objects once it
                      // has run, and the inspector reads ids.
                      onClick={() =>
                        onSelectEdge({
                          ...(link as unknown as GraphEdge),
                          source: endpointId(link.source) ?? "",
                          target: endpointId(link.target) ?? "",
                        })
                      }
                      className="hover:text-foreground focus-visible:ring-ring rounded text-left underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-1"
                    >
                      {describeEdge(link)}
                    </button>
                  ) : (
                    describeEdge(link)
                  )}
                </td>
                <td className="px-2 py-1">{captionFor(endpointId(link.target))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
