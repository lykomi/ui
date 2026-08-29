import { lazy } from "react";
import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { GRAPH_PANEL_TYPE, graphPanelPayload } from "./graph-panel-content.ts";

const GraphPanelRenderer = lazy(() => import("./graph-panel.tsx"));

/**
 * Teach the tool panel to render graphs.
 *
 * Call once at app start, or from a `ChatModule`'s `useInit`. Idempotent: the
 * entry carries a stable id, and the store replaces a same-id entry rather than
 * appending, so a StrictMode double-render or a hot reload cannot stack copies.
 */
export function registerGraphPanelRenderer(): void {
  useToolPanelStore.getState().registerRenderer({
    id: "foundry.graph",
    match: (content) => content.type === GRAPH_PANEL_TYPE && graphPanelPayload(content) !== null,
    component: GraphPanelRenderer,
  });
}
