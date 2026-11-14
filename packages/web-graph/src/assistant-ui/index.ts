/**
 * Chat glue: the assistant-ui tool card and the tool-panel renderer.
 *
 * Split into its own entry point so the root export stays free of
 * `@assistant-ui/react` — a host that only wants to draw a graph (a dashboard,
 * a report page) imports `@lykomi/web-graph` and never loads the
 * chat runtime.
 */

export { GraphToolUI, makeGraphToolUI, type MakeGraphToolUIOptions } from "./graph-tool-ui.tsx";
export { GraphProvenance } from "./graph-provenance.tsx";
export { GraphResultSeeder, seedableGraphResults } from "./graph-result-seeder.tsx";
export { graphToolBindings, type GraphToolBinding } from "./graph-tool-registry.ts";
export { registerGraphPanelRenderer } from "./register-graph-panel.ts";
export { mergeIntoOpenGraph } from "./merge-into-panel.ts";
export {
  graphExpander,
  registerGraphExpander,
  type GraphExpander,
  type GraphExpandOptions,
} from "./graph-expander.ts";
export {
  GRAPH_SELECTION_CONTEXT_KEY,
  GraphContextPinButton,
  syncGraphSelectionContext,
} from "./graph-context.tsx";
export { GRAPH_CLIENT_TOOLS, registerGraphClientTools } from "./graph-client-tools.ts";
export {
  GRAPH_PANEL_TYPE,
  graphPanelContent,
  graphPanelPayload,
  type GraphPanelContent,
  type GraphPanelContentLike,
} from "./graph-panel-content.ts";
