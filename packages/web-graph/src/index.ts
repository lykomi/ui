/**
 * `@iloveagents/foundry-web-graph` — the source-agnostic graph visualizer.
 *
 * Nothing exported from here knows about Neo4j, assistant-ui, or the chat
 * shell. The Neo4j mapping is `@iloveagents/foundry-web-graph/adapters/neo4j`;
 * the chat card and panel renderer are
 * `@iloveagents/foundry-web-graph/assistant-ui`.
 */

export {
  GRAPH_PAYLOAD_KIND,
  GRAPH_PAYLOAD_VERSION,
  DEFAULT_CAPTION_KEYS,
  coerceGraphPayload,
  emptyGraphPayload,
  isGraphPayload,
  mergeGraphPayloads,
  primaryLabel,
  pruneDanglingEdges,
  resolveCaption,
  edgeCaption,
  safeHref,
  type GraphDetail,
  type GraphEdgeEmphasis,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "./model.ts";

export { GraphView, type GraphViewHandle, type GraphViewProps } from "./graph-view.tsx";
export { GraphLegend, type GraphLegendProps } from "./graph-legend.tsx";
export { GraphInspector, type GraphInspectorProps } from "./graph-inspector.tsx";
export { GraphToolbar, type GraphToolbarProps } from "./graph-toolbar.tsx";
export { GraphTable, type GraphTableProps } from "./graph-table.tsx";
export { GraphEmptyState, GraphLossNotice } from "./graph-notice.tsx";

export {
  DEFAULT_LIMITS,
  reconcileGraphModel,
  selectConnectedCore,
  useGraphModel,
  type EngineLink,
  type EngineNode,
  type GraphModel,
  type GraphModelLimits,
  type GraphModelLoss,
} from "./use-graph-model.ts";
export {
  useGraphStyling,
  type GraphStyleMap,
  type GraphStyling,
  type NodeStyle,
} from "./use-graph-styling.ts";
export {
  useGraphViewState,
  type GraphSelection,
  type GraphViewState,
} from "./use-graph-view-state.ts";
export { useGraphTheme } from "./use-graph-theme.ts";
export { FALLBACK_THEME, resolveGraphTheme, type GraphTheme } from "./theme.ts";
export {
  findWorkspaceNode,
  graphWorkspaceStore,
  isGraphOpen,
  type GraphWorkspaceState,
} from "./graph-workspace.ts";
export { graphLink, type GraphLink } from "./graph-links.ts";
export type { GraphLayout } from "./graph-canvas.tsx";
