import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import {
  mergeGraphPayloads,
  safeStringify,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "../model.ts";
import { graphWorkspaceStore } from "../graph-workspace.ts";
import { GRAPH_PANEL_TYPE, graphPanelContent } from "./graph-panel-content.ts";

/**
 * Fold a fresh result into the graph the user already has open.
 *
 * The panel is a workspace, not a slideshow. When the agent expands a node or
 * writes one, the answer is about the graph on screen — so it belongs in that
 * graph, appearing beside what it connects to, rather than arriving as a
 * separate picture the user has to open and mentally join up.
 *
 * Doing it here rather than asking the model to call `graph_show` afterwards
 * also keeps the turn to a single tool call. Two calls in one turn is where
 * the AG-UI client-tool replay gets into trouble, and "the agent remembered to
 * call the second tool" is not a foundation to build the main interaction on.
 *
 * Merges only when the new payload SHARES a node with what is on screen. That
 * overlap is the evidence the two results are about the same thing; without
 * it, an unrelated query would quietly graft itself onto someone's workspace.
 *
 * @returns whether the open graph was updated.
 */
export function mergeIntoOpenGraph(payload: GraphPayload): boolean {
  const current = graphWorkspaceStore.getState().payload;
  // An empty payload is not a merge. It is usually a write that DELETED
  // something, and merging cannot express a removal — there is no row for a
  // node that no longer exists, and nothing here can know which ids went. The
  // write tool therefore marks its own result `view_stale` and tells the agent
  // to re-read; silently treating this as "no change" is what would leave the
  // panel drawing a node the database no longer has.
  if (!current || payload.nodes.length === 0) return false;

  const panel = useToolPanelStore.getState();
  const content = panel.content;
  if (!panel.isOpen || content?.type !== GRAPH_PANEL_TYPE) return false;

  const onScreen = new Set(current.nodes.map((node) => node.id));
  if (!payload.nodes.some((node) => onScreen.has(node.id))) return false;

  // Nothing new AND nothing changed: re-setting identical content would churn
  // the store and re-run the panel's effects for no visible difference.
  //
  // "New" is not enough on its own. `MATCH (n) SET n.status = $status RETURN n`
  // is an ordinary write whose result carries only ids the graph already has,
  // and an id-only test threw it away — leaving the details drawer showing the
  // property the user just changed, at its old value. `mergeGraphPayloads`
  // already lets the fresher entity win; this test only decides whether to ask
  // it to.
  const byId = new Map<string, GraphNode | GraphEdge>();
  for (const node of current.nodes) byId.set(node.id, node);
  for (const edge of current.edges) byId.set(edge.id, edge);
  const differs = (entity: GraphNode | GraphEdge) => {
    const existing = byId.get(entity.id);
    return existing === undefined || safeStringify(existing) !== safeStringify(entity);
  };
  if (!payload.nodes.some(differs) && !payload.edges.some(differs)) return false;

  panel.setContent(graphPanelContent(content.title, mergeGraphPayloads(current, payload)) as never);
  return true;
}
