import { clientToolRegistry, type ClientToolEntry } from "@iloveagents/foundry-agent";
import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { coerceGraphPayload, primaryLabel, resolveCaption, type GraphNode } from "../model.ts";
import { findWorkspaceNode, graphWorkspaceStore } from "../graph-workspace.ts";
import { graphPanelContent } from "./graph-panel-content.ts";

/**
 * Client tools that let the agent work IN the open graph, not just hand one
 * over.
 *
 * These execute in the browser, so they act on what the user is actually
 * looking at — the live panel, its current selection, its current search.
 * That is the difference between an agent that can produce a picture and one
 * you can have a conversation with about the picture.
 */

const describe = (node: GraphNode) => ({
  id: node.id,
  labels: node.labels ?? [],
  caption: resolveCaption(node),
  properties: node.properties ?? {},
});

const ok = (value: unknown) => JSON.stringify(value);
const fail = (message: string) => JSON.stringify({ error: message });

function parseArgs(argsJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argsJson || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const showGraph: ClientToolEntry = {
  name: "graph_show",
  description:
    "Display a graph in the side panel, replacing whatever is there. Node positions are kept " +
    "for nodes that were already on screen, so an updated query reads as a change rather than " +
    "a new picture. Pass the same payload a graph tool returned.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Panel heading, e.g. the question this answers." },
      graph: { type: "object", description: "A graph payload (kind: 'foundry.graph')." },
    },
    required: ["graph"],
  },
  execute: async (argsJson) => {
    const args = parseArgs(argsJson);
    const payload = coerceGraphPayload(args.graph);
    if (!payload) return fail("That is not a graph payload (expected kind: 'foundry.graph').");
    const title = typeof args.title === "string" && args.title ? args.title : "Graph";
    useToolPanelStore.getState().openPanel(graphPanelContent(title, payload) as never);
    return ok({ shown: true, nodes: payload.nodes.length, edges: payload.edges.length });
  },
};

const selectNode: ClientToolEntry = {
  name: "graph_select_node",
  description:
    "Select a node in the open graph and centre the view on it, as if the user had clicked it. " +
    "Accepts a node id or a caption such as a name or title. Returns the node's properties.",
  parameters: {
    type: "object",
    properties: {
      node: { type: "string", description: "Node id, or its caption (name/title)." },
    },
    required: ["node"],
  },
  execute: async (argsJson) => {
    const args = parseArgs(argsJson);
    const needle = typeof args.node === "string" ? args.node : "";
    const { handle } = graphWorkspaceStore.getState();
    if (!handle) return fail("No graph is open. Call graph_show first.");
    const node = findWorkspaceNode(needle);
    if (!node) return fail(`No node matching "${needle}" is in the open graph.`);
    handle.select(node.id);
    handle.centerOn(node.id);
    return ok({ selected: describe(node) });
  },
};

const searchGraph: ClientToolEntry = {
  name: "graph_search",
  description:
    "Highlight nodes in the open graph matching a term, dimming the rest. Searches captions, " +
    "labels and property values. Pass an empty string to clear.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Text to highlight. Empty clears." } },
    required: ["query"],
  },
  execute: async (argsJson) => {
    const args = parseArgs(argsJson);
    const query = typeof args.query === "string" ? args.query : "";
    const { handle, payload } = graphWorkspaceStore.getState();
    if (!handle || !payload) return fail("No graph is open. Call graph_show first.");
    handle.search(query);
    return ok({ query, of: payload.nodes.length });
  },
};

const getView: ClientToolEntry = {
  name: "graph_get_view",
  description:
    "Read what the user is currently looking at: the open graph's title, its node and " +
    "relationship counts, the types present, the selected node, and any active search. Call " +
    "this before answering a question about 'this' node or 'the graph' on screen.",
  parameters: { type: "object", properties: {} },
  execute: async () => {
    const { payload, title, selection, query } = graphWorkspaceStore.getState();
    if (!payload) return ok({ open: false });
    const labels: Record<string, number> = {};
    for (const node of payload.nodes) {
      const label = primaryLabel(node);
      labels[label] = (labels[label] ?? 0) + 1;
    }
    const types: Record<string, number> = {};
    for (const edge of payload.edges) {
      const type = edge.type ?? "RELATED";
      types[type] = (types[type] ?? 0) + 1;
    }
    return ok({
      open: true,
      title,
      nodeCount: payload.nodes.length,
      edgeCount: payload.edges.length,
      truncated: payload.truncated ?? false,
      labels,
      relationshipTypes: types,
      selectedNode: selection ? describe(selection) : null,
      search: query || null,
    });
  },
};

export const GRAPH_CLIENT_TOOLS: ClientToolEntry[] = [
  showGraph,
  selectNode,
  searchGraph,
  getView,
];

/**
 * Register the graph client tools globally.
 *
 * Global rather than page-scoped: the panel is available from every route, so
 * scoping them to one page would make the agent's ability to drive the graph
 * depend on where the user happens to be standing. Re-registering by the same
 * name replaces the entry, so this is safe to call from a `useInit`.
 */
export function registerGraphClientTools(): void {
  const { registerGlobal } = clientToolRegistry.getState();
  for (const tool of GRAPH_CLIENT_TOOLS) registerGlobal(tool);
}
