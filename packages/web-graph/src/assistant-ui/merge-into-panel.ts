import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { mergeGraphPayloads, type GraphPayload } from "../model.ts";
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
  if (!current || payload.nodes.length === 0) return false;

  const panel = useToolPanelStore.getState();
  const content = panel.content;
  if (!panel.isOpen || content?.type !== GRAPH_PANEL_TYPE) return false;

  const onScreen = new Set(current.nodes.map((node) => node.id));
  if (!payload.nodes.some((node) => onScreen.has(node.id))) return false;

  // Nothing new: re-setting identical content would churn the store and
  // re-run the panel's effects for no visible change.
  const known = new Set([...onScreen, ...current.edges.map((edge) => edge.id)]);
  const adds =
    payload.nodes.some((node) => !known.has(node.id)) ||
    payload.edges.some((edge) => !known.has(edge.id));
  if (!adds) return false;

  panel.setContent(graphPanelContent(content.title, mergeGraphPayloads(current, payload)) as never);
  return true;
}
