import { graphViewSummary } from "../graph-view-summary.ts";
import { clientToolRegistry, type ClientToolEntry } from "@iloveagents/foundry-agent";
import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import {
  coerceGraphPayload,
  edgeCaption,
  hasOwn,
  mergeGraphPayloads,
  primaryLabel,
  resolveCaption,
  safeStringify,
  type GraphNode,
  type GraphPayload,
} from "../model.ts";
import { findWorkspaceNode, graphWorkspaceStore, isAmbiguous } from "../graph-workspace.ts";
import { GRAPH_PANEL_TYPE, graphPanelContent } from "./graph-panel-content.ts";

/**
 * Client tools that let the agent work IN the open graph, not just hand one
 * over.
 *
 * These execute in the browser, so they act on what the user is actually
 * looking at — the live panel, its current selection, its current search.
 * That is the difference between an agent that can produce a picture and one
 * you can have a conversation with about the picture.
 */

/**
 * A node as the AGENT should see it — captioned the way the canvas paints it.
 *
 * The payload\'s `legend.captionKey` is a supported part of the contract, and
 * where a producer sets one, resolving without it names the node something
 * that appears nowhere on screen. `findWorkspaceNode` already matches with the
 * legend key, so without this the tool could find a node by the caption the
 * user can see and then report a different name back.
 */
const describe = (node: GraphNode, legend?: GraphPayload["legend"]) => {
  const label = primaryLabel(node);
  const captionKey = legend && hasOwn(legend, label) ? legend[label]?.captionKey : undefined;
  return {
    id: node.id,
    labels: node.labels ?? [],
    caption: resolveCaption(node, captionKey),
    // What the user reads in the drawer, so a question about it has it.
    ...(node.details?.length ? { details: node.details } : {}),
    properties: node.properties ?? {},
  };
};

// Not `JSON.stringify`: every one of these results carries node properties
// straight out of the database, and a `bigint` there would throw inside the
// tool rather than answering it.
const ok = (value: unknown) => safeStringify(value);
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
    "Show a graph in the side panel. Updates the graph already open rather than opening a " +
    "second one, and keeps the positions of nodes that were already on screen, so a new " +
    "result reads as a change rather than a new picture. Set merge: true to ADD to what is " +
    "on screen — always do that for an expansion or a write, so the new part appears beside " +
    "what it connects to. Pass the payload a graph tool returned.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Panel heading, e.g. the question this answers." },
      graph: { type: "object", description: "A graph payload (kind: 'foundry.graph')." },
      merge: {
        type: "boolean",
        description:
          "Add to the graph on screen instead of replacing it. Use for expansions and writes.",
      },
    },
    required: ["graph"],
  },
  execute: async (argsJson) => {
    const args = parseArgs(argsJson);
    const payload = coerceGraphPayload(args.graph);
    if (!payload) return fail("That is not a graph payload (expected kind: 'foundry.graph').");

    const workspace = graphWorkspaceStore.getState();
    const merging = args.merge === true && workspace.payload !== null;
    const next = merging ? mergeGraphPayloads(workspace.payload!, payload) : payload;
    const title =
      typeof args.title === "string" && args.title
        ? args.title
        : ((merging ? workspace.title : null) ?? "Graph");

    // Update in place when a graph is already up. `openPanel` would do the
    // same to the store, but going through `setContent` says what is meant:
    // this is the same workspace changing, not a new one — which is also how
    // it behaves on screen, since the renderer instance is reused and the
    // layout reconciles by node id.
    const panel = useToolPanelStore.getState();
    const content = graphPanelContent(title, next);
    if (panel.isOpen && panel.content?.type === GRAPH_PANEL_TYPE) panel.setContent(content);
    else panel.openPanel(content);

    return ok({
      shown: true,
      merged: merging,
      nodes: next.nodes.length,
      edges: next.edges.length,
      added: merging ? next.nodes.length - workspace.payload!.nodes.length : next.nodes.length,
    });
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
    const { handle, payload: openPayload } = graphWorkspaceStore.getState();
    if (!handle) return fail("No graph is open. Call graph_show first.");
    const legend = openPayload?.legend;
    const captionOf = (node: GraphNode) => describe(node, legend).caption;
    const match = findWorkspaceNode(needle);
    if (!match) return fail(`No node matching "${needle}" is in the open graph.`);
    // Several nodes answer to that text. Picking one would be a confident
    // wrong answer the user cannot see — duplicate captions are ordinary — so
    // hand back the candidates WITH their ids, which is what the agent needs
    // to ask a real question or select precisely.
    if (isAmbiguous(match)) {
      const options = match.ambiguous
        .slice(0, 10)
        .map((n) => `${describe(n, openPayload?.legend).caption} (id ${n.id})`)
        .join(", ");
      return fail(
        `"${needle}" matches ${match.ambiguous.length} nodes in the open graph: ${options}. ` +
          `Select by id, or ask the user which one they mean.`,
      );
    }
    const node = match;
    // A node can be in the workspace payload and still not be RENDERED — the
    // view caps a large graph to its connected core — and reporting a
    // selection that did not happen sends the agent on to describe something
    // the user cannot see.
    if (!handle.select(node.id)) {
      // Two different reasons a node is not drawn, and they need opposite
      // advice. A legend filter is undone by turning the label back on;
      // narrowing the query cannot bring back something the USER switched off,
      // so telling the agent to narrow sends it somewhere that cannot work.
      const hidden = handle.getViewState().hiddenLabels;
      const label = primaryLabel(node);
      if (hidden.includes(label)) {
        return fail(
          `"${captionOf(node)}" is in this result but hidden: the "${label}" filter is ` +
            `switched off in the legend. Ask the user to turn it back on to see this node.`,
        );
      }
      return fail(
        `"${captionOf(node)}" is in this result but not drawn — the view is showing the ` +
          `most connected part of a graph too large for one screen. Narrow the query to bring ` +
          `it in.`,
      );
    }
    // Reveal, not centre: the user framed this graph, and a tool that
    // re-centres on every mention throws that away. Move only if the node is
    // off-screen or behind the details drawer.
    handle.reveal(node.id);
    return ok({ selected: describe(node, legend) });
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
    const { payload, title, handle } = graphWorkspaceStore.getState();
    if (!payload || !handle) return ok({ open: false });

    // Read the VIEW, not the payload. Two different things were being lost by
    // counting the payload: the render cap keeps only the connected core of a
    // graph too big for one screen, and a label switched off in the legend
    // takes its nodes and their relationships off the canvas. Either way the
    // agent was describing a graph the user was not looking at — and could
    // name a node that is not drawn.
    const view = handle.getViewState();

    // Counted into a `Map`, not `{}`. Labels and relationship types come from
    // the payload, which is source-neutral and untrusted — a graph is free to
    // have a label called `constructor` or `toString`, and reading those off
    // an object literal finds an inherited function instead of "not counted
    // yet". The count then either throws or lands in the result as something
    // that is not a number.
    const labels = new Map<string, number>();
    for (const node of view.nodes) {
      const label = primaryLabel(node);
      labels.set(label, (labels.get(label) ?? 0) + 1);
    }
    const types = new Map<string, number>();
    for (const edge of view.edges) {
      const type = edge.type ?? "RELATED";
      types.set(type, (types.get(type) ?? 0) + 1);
    }
    return ok({
      open: true,
      title,
      ...graphViewSummary(view, payload),
      // The producer's own truncation OR the render cap. Reporting only the
      // former said `false` while the UI was showing a loss notice.
      labels: Object.fromEntries(labels),
      relationshipTypes: Object.fromEntries(types),
      // Named, so the agent can say "Person is hidden" rather than silently
      // reporting a smaller graph than the query returned.
      selectedNode: view.selection ? describe(view.selection, payload.legend) : null,
      // A selected node whose label the legend hides stays selected — the
      // drawer is still open and its properties are still what the user is
      // reading — but it is NOT in `nodeCount` or among the drawn nodes. Said
      // plainly here, so the agent can answer "selected, though its label is
      // currently hidden" instead of describing a node this same result says
      // is not on screen.
      // A relationship can be selected too, and the drawer shows it. Reporting
      // only nodes said "nothing is selected" with an edge plainly selected.
      selectedRelationship: view.selectedEdge
        ? {
            id: view.selectedEdge.id,
            type: view.selectedEdge.type ?? "RELATED",
            caption: edgeCaption(view.selectedEdge),
            ...(view.selectedEdge.emphasis ? { emphasis: view.selectedEdge.emphasis } : {}),
            ...(view.selectedEdge.details?.length ? { details: view.selectedEdge.details } : {}),
            source: view.selectedEdge.source,
            target: view.selectedEdge.target,
            properties: view.selectedEdge.properties ?? {},
          }
        : null,
    });
  },
};

export const GRAPH_CLIENT_TOOLS: ClientToolEntry[] = [showGraph, selectNode, searchGraph, getView];

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
