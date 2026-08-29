import { defineChatModule } from "@iloveagents/foundry-web-shell";
import {
  GraphToolUI,
  makeGraphToolUI,
  registerGraphClientTools,
  registerGraphPanelRenderer,
} from "@iloveagents/foundry-web-graph/assistant-ui";

/**
 * Bind the graph card to this app's tool names.
 *
 * `makeGraphToolUI` is a factory because assistant-ui binds a literal tool name
 * at construction — so the card is not tied to any particular backend. Adding a
 * new graph-returning tool is one more line here.
 */

// The cards stay compact summaries; "Open in panel" puts the graph in the side
// panel, where it has the room to be readable. Deliberately not automatic — a
// panel that opens itself on every query takes the screen away from whatever
// the user was reading.
const GraphSchemaToolUI = makeGraphToolUI({
  toolName: "graph_schema",
  title: "Graph schema",
});

const GraphReadToolUI = makeGraphToolUI({
  toolName: "graph_read_cypher",
  title: "Graph query",
  panelTitle: (payload) => {
    const query = (payload.meta as { query?: string } | undefined)?.query;
    return query ? `Cypher — ${query.slice(0, 60)}` : "Graph query";
  },
});

const GraphVectorSearchToolUI = makeGraphToolUI({
  toolName: "graph_vector_search",
  title: "Semantic graph search",
});

function useGraphModuleInit() {
  // Teaches the side panel to render `type: "graph"` content. Idempotent, so a
  // StrictMode double-render or a hot reload cannot stack registrations.
  registerGraphPanelRenderer();
  // Gives the agent graph_show / graph_select_node / graph_search /
  // graph_get_view, executed in the browser against the open panel. This is
  // what makes the graph a workspace the two of you share rather than a
  // picture the agent hands over: it can see what you have selected and act
  // on it, and you can see what it did.
  registerGraphClientTools();
}

export const graphModule = defineChatModule({
  name: "neo4j-graph",
  useInit: useGraphModuleInit,
  toolUIs: (
    <>
      <GraphSchemaToolUI />
      <GraphReadToolUI />
      <GraphVectorSearchToolUI />
      {/* Lets the agent put any graph in the panel via a `show_graph` tool. */}
      <GraphToolUI />
    </>
  ),
});