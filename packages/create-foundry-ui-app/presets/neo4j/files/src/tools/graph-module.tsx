import { useEffect } from "react";
import { defineChatModule } from "@iloveagents/foundry-web-shell";
import {
  GraphResultSeeder,
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

// The two collaboration moves. Both need a card of their own, and not for the
// card's sake: binding a card is what registers the tool as graph-shaped, and
// `GraphResultSeeder` below is what folds its result into the graph already on
// screen. A tool with no card is a tool the panel never hears about — the
// agent narrates an expansion that never arrives.
const GraphExpandToolUI = makeGraphToolUI({
  toolName: "graph_expand_node",
  title: "Expand node",
});

const GraphWriteToolUI = makeGraphToolUI({
  toolName: "graph_write_cypher",
  title: "Graph write",
  panelTitle: (payload) => {
    const query = (payload.meta as { query?: string } | undefined)?.query;
    return query ? `Wrote — ${query.slice(0, 60)}` : "Graph write";
  },
});

function useGraphModuleInit() {
  // In an EFFECT, not the hook body. `useInit` runs on every `ShellLayout`
  // render, and both registries replace their collection on each call — so
  // registering here directly wrote to two stores during render, notifying
  // subscribed components mid-render on every route change and theme flip.
  // Idempotent either way (a StrictMode double-render or a hot reload cannot
  // stack them), but idempotent is not the same as free.
  //
  // Safe to defer: the panel renderer is only needed once graph content
  // exists, and the client tools once the agent calls one — both far after
  // mount.
  useEffect(() => {
    // Teaches the side panel to render `type: "graph"` content.
    registerGraphPanelRenderer();
    // Gives the agent graph_show / graph_select_node / graph_search /
    // graph_get_view, executed in the browser against the open panel. This is
    // what makes the graph a workspace the two of you share rather than a
    // picture the agent hands over: it can see what you have selected and act
    // on it, and you can see what it did.
    registerGraphClientTools();
  }, []);
}

export const graphModule = defineChatModule({
  name: "neo4j-graph",
  useInit: useGraphModuleInit,
  toolUIs: (
    <>
      <GraphSchemaToolUI />
      <GraphReadToolUI />
      <GraphVectorSearchToolUI />
      <GraphExpandToolUI />
      <GraphWriteToolUI />
      {/* Headless, and load-bearing: the cards above live inside the turn's
          collapsed activity strip and do not mount until someone expands it.
          This watches the thread's own parts instead, so a result reaches the
          panel whether or not anybody opened the card. */}
      <GraphResultSeeder />
      {/* Lets the agent put any graph in the panel via a `show_graph` tool. */}
      <GraphToolUI />
    </>
  ),
});
