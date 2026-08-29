import { useCallback, useEffect, useMemo, useRef } from "react";
import { GraphView, type GraphViewHandle } from "../graph-view.tsx";
import { primaryLabel, resolveCaption, type GraphNode } from "../model.ts";
import { GraphEmptyState } from "../graph-notice.tsx";
import { graphWorkspaceStore } from "../graph-workspace.ts";
import { submitComposerText } from "@iloveagents/foundry-web-ui";
import { graphPanelPayload, type GraphPanelContentLike } from "./graph-panel-content.ts";
import { GraphContextPinButton, syncGraphSelectionContext } from "./graph-context.tsx";

/**
 * Full-size graph for the tool panel, connected to the shared workspace.
 *
 * Default-exported and loaded through `React.lazy` from
 * `registerGraphPanelRenderer`, so neither this nor the force engine is in the
 * bundle until a graph panel is actually opened.
 */
export default function GraphPanel({ content }: { content: GraphPanelContentLike }) {
  const handleRef = useRef<GraphViewHandle>(null);
  // Memoised on the panel's own content, so an unrelated re-render does not
  // hand `GraphView` a new payload object and re-run the workspace effect.
  const payload = useMemo(() => graphPanelPayload(content), [content]);

  /**
   * Expand through the conversation, not behind it.
   *
   * The panel cannot query the graph — the Cypher tools live on the server, as
   * they must. So a double-click asks the agent, in the chat, the way the user
   * would: the turn is visible, the agent picks the traversal, and the answer
   * merges into the graph on screen. The expansion becomes part of the
   * conversation rather than a side effect nobody can refer back to.
   */
  const expandNode = useCallback((node: GraphNode) => {
    const caption = resolveCaption(node);
    submitComposerText(
      `Expand "${caption}" (${primaryLabel(node)}) in the graph — node id ${node.id}.`,
    );
  }, []);

  // Publish this panel as THE live graph, so the agent's client tools can read
  // what is on screen and drive it. Registering the handle is what lets
  // `graph_select_node` and `graph_search` reach into a mounted view.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || !payload) return;
    graphWorkspaceStore.getState().connect(handle, content.title, payload);
    return () => {
      graphWorkspaceStore.getState().disconnect(handle);
      // Otherwise a node from a closed panel stays in the chat context and
      // the agent answers about a graph nobody can see.
      syncGraphSelectionContext(null, "");
    };
  }, [content.title, payload]);

  if (!payload) {
    return <GraphEmptyState message="This panel does not contain a readable graph." />;
  }

  // `absolute inset-0`, not `h-full`.
  //
  // The tool panel's content wrapper is `relative flex-1 overflow-y-auto` — a
  // scroll container. A percentage height inside one resolves against the
  // CONTENT box, so `h-full` lets the canvas grow past the visible area: the
  // graph gets correctly fitted into a canvas taller than the panel, and the
  // bottom half is simply below the fold. Pinning to the positioned ancestor
  // makes the canvas exactly the size of what the user can see, which is also
  // what the ResizeObserver needs to re-fit on drag-resize and fullscreen.
  return (
    <div className="absolute inset-0 p-3">
      <GraphView
        data={payload}
        variant="full"
        height="100%"
        handleRef={handleRef}
        onExpandNode={expandNode}
        // The user's clicks and the agent's reads share one piece of state, so
        // "tell me about this node" needs no restating on either side.
        onSelectionChange={(node) => {
          graphWorkspaceStore.getState().setSelection(node);
          // The selected node joins the conversation automatically, so
          // "tell me about this" needs no restating on either side.
          syncGraphSelectionContext(node, `graph:${content.title}`);
        }}
        inspectorActions={(node) => <GraphContextPinButton node={node} />}
        onQueryChange={(query) => graphWorkspaceStore.getState().setQuery(query)}
      />
    </div>
  );
}
