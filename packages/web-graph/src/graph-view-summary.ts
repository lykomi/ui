import type { GraphViewHandle } from "./graph-view.tsx";
import type { GraphPayload } from "./model.ts";

/** Shared truth for focused request context and graph_get_view. */
export function graphViewSummary(
  view: ReturnType<GraphViewHandle["getViewState"]>,
  payload: GraphPayload | null,
) {
  return {
    nodeCount: view.nodes.length,
    edgeCount: view.edges.length,
    truncated: Boolean(payload?.truncated || view.lossy),
    hiddenLabels: view.hiddenLabels,
    hiddenNodeCount: (payload?.nodes.length ?? view.nodes.length) - view.nodes.length,
    selectedNodeHidden: view.selection ? !view.selectionDrawn : false,
    selectedEdgeHidden: view.selectedEdge
      ? !view.edges.some((edge) => edge.id === view.selectedEdge?.id)
      : false,
    search: view.query || null,
  };
}
