import { graphViewSummary } from "../graph-view-summary.ts";
import { useGraphSurfaceVisible } from "./use-graph-surface-visible.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { GraphView, type GraphViewHandle } from "../graph-view.tsx";
import {
  edgeCaption,
  hasOwn,
  jsonSafe,
  primaryLabel,
  resolveCaption,
  type GraphNode,
} from "../model.ts";
import { GraphEmptyState } from "../graph-notice.tsx";
import { graphWorkspaceStore } from "../graph-workspace.ts";
import {
  DataTableFrame,
  useDataTableFrame,
  submitComposerText,
  useAppStore,
} from "@iloveagents/foundry-web-ui";
import { graphPanelPayload, type GraphPanelContentLike } from "./graph-panel-content.ts";
import { graphExpander } from "./graph-expander.ts";
import { mergeIntoOpenGraph } from "./merge-into-panel.ts";
import {
  GraphContextPinButton,
  syncGraphSelectionContext,
  syncGraphEdgeContext,
} from "./graph-context.tsx";

/**
 * Full-size graph for the tool panel, connected to the shared workspace.
 *
 * Default-exported and loaded through `React.lazy` from
 * `registerGraphPanelRenderer`, so neither this nor the force engine is in the
 * bundle until a graph panel is actually opened.
 */
export default function GraphPanel({ content }: { content: GraphPanelContentLike }) {
  return (
    <DataTableFrame
      data-focus-kind="graph"
      aria-label={content.title}
      className="absolute inset-0 flex min-h-0 flex-col p-3"
      focusClassName="p-3 sm:p-3"
    >
      <GraphPanelBody content={content} />
    </DataTableFrame>
  );
}
function GraphPanelBody({ content }: { content: GraphPanelContentLike }) {
  const frame = useDataTableFrame();
  const handleRef = useRef<GraphViewHandle>(null);
  // The shell can recreate the small panel-content wrapper on every chat
  // streaming update. Its payload fields are unchanged, and treating the new
  // wrapper as new graph data restarts the force simulation and auto-fit loop;
  // that loop then fights the user's wheel zoom until streaming stops.
  const payload = useMemo(() => graphPanelPayload(content), [content.content, content.data]);
  const { ref: surfaceRef, visible: isOpen } = useGraphSurfaceVisible(frame?.focused);
  const currentPage = useAppStore((state) => state.currentPage);

  /**
   * The payload's caption key for this node's label.
   *
   * Every path that NAMES a node — the expansion prompt, the chat-context
   * chip, the client tools — resolves through the same rule the canvas paints
   * by, or the same node ends up with two names and the agent discusses one
   * the user cannot see.
   */
  const captionKeyFor = useCallback(
    (node: GraphNode) => {
      const legend = payload?.legend;
      const label = primaryLabel(node);
      return legend && hasOwn(legend, label) ? legend[label]?.captionKey : undefined;
    },
    [payload],
  );

  /**
   * Expand through the conversation, not behind it — the default.
   *
   * The panel cannot query the graph — the Cypher tools live on the server, as
   * they must. So a double-click asks the agent, in the chat, the way the user
   * would: the turn is visible, the agent picks the traversal, and the answer
   * merges into the graph on screen. A host that CAN read the graph registers
   * an expander instead (`registerGraphExpander`), and this stays "Ask AI".
   */
  const askAgentToExpand = useCallback(
    (node: GraphNode) => {
      submitComposerText(
        `Expand "${resolveCaption(node, captionKeyFor(node))}" (${primaryLabel(node)}) in the graph — node id ${node.id}.`,
      );
    },
    [captionKeyFor],
  );

  const [expandNotice, setExpandNotice] = useState<string | null>(null);

  /**
   * Expand straight from the host's backend when it registered an expander
   * (`registerGraphExpander`); otherwise, or when it cannot expand this node,
   * through the conversation.
   */
  const expandNode = useCallback(
    async (node: GraphNode) => {
      const expander = graphExpander();
      if (!expander) {
        askAgentToExpand(node);
        return;
      }
      setExpandNotice(null);
      try {
        const result = await expander(node, { hops: 1 });
        if (result === null) {
          askAgentToExpand(node);
          return;
        }
        if (result.nodes.length <= 1) {
          setExpandNotice("Nothing more is connected to this node.");
        } else if (!mergeIntoOpenGraph(result)) {
          setExpandNotice("The neighbours could not be added to this graph.");
        }
      } catch {
        setExpandNotice("The neighbours could not be loaded. Try again, or ask the AI.");
      }
    },
    [askAgentToExpand],
  );

  // Publish this panel as THE live graph, so the agent's client tools can read
  // what is on screen and drive it. Registering the handle is what lets
  // `graph_select_node` and `graph_search` reach into a mounted view.
  //
  // Gated on `isOpen`, because closing the panel does not unmount it — the
  // tool panel slides off-screen with `translate-x-full` and stays in the
  // tree. Without this the workspace stayed connected to a graph nobody could
  // see, and `graph_get_view` went on describing it.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || !payload || !isOpen) return;
    const workspace = graphWorkspaceStore.getState();
    workspace.connect(handle, content.title, payload);
    // Republish what the view is already showing. `disconnect` cleared the
    // workspace when the panel closed, but the view was never unmounted — so
    // reopening it leaves the drawer and the search box exactly as they were
    // while `graph_get_view` reports neither, and the selected node is missing
    // from the chat context. The callbacks cannot help: they fire on CHANGE,
    // and from the view's side nothing changed.
    const view = handle.getViewState();
    workspace.setSelection(view.selection);
    syncGraphEdgeContext(view.selectedEdge, `graph:${content.title}`);
    workspace.setQuery(view.query);
    workspace.setHiddenLabels(view.hiddenLabels);
    syncGraphSelectionContext(
      view.selection,
      `graph:${content.title}`,
      view.selection ? captionKeyFor(view.selection) : undefined,
    );
    return () => {
      if (graphWorkspaceStore.getState().handle === handle) {
        syncGraphSelectionContext(null, "");
        syncGraphEdgeContext(null, "");
      }
      graphWorkspaceStore.getState().disconnect(handle);
    };
    // `currentPage` is a dependency for the same reason `isOpen` is, and it is
    // easy to miss because the panel does not move: `setCurrentPage` clears
    // every keyed and ephemeral context item on navigation, on the reasonable
    // assumption that a keyed item tracks UI the navigation just unmounted.
    // The tool panel is the exception — it belongs to the shell, so the graph
    // and its open drawer survive a route change while the selected node
    // silently drops out of the conversation. Nothing fires to put it back:
    // the selection did not change. Re-running this republishes it, which is
    // the same job it already does for reopening a closed panel.
  }, [content.title, payload, isOpen, currentPage]);

  useEffect(() => {
    const surface = surfaceRef.current?.closest("[data-focused]");
    if (!surface) return;
    const collect = (event: Event) => {
      const workspace = graphWorkspaceStore.getState();
      const view = workspace.handle?.getViewState();
      if (!view) return;
      (event as CustomEvent).detail.context = {
        kind: "graph",
        title: workspace.title,
        ...graphViewSummary(view, workspace.payload),
        selectedNode: view.selection
          ? {
              id: view.selection.id,
              label: resolveCaption(
                view.selection,
                workspace.payload?.legend?.[primaryLabel(view.selection)]?.captionKey,
              ),
              // What the drawer shows first is what "this" refers to.
              ...(view.selection.details?.length
                ? { details: jsonSafe(view.selection.details) }
                : {}),
            }
          : null,
        selectedRelationship: view.selectedEdge
          ? {
              id: view.selectedEdge.id,
              source: view.selectedEdge.source,
              target: view.selectedEdge.target,
              type: view.selectedEdge.type,
              caption: edgeCaption(view.selectedEdge),
              ...(view.selectedEdge.details?.length
                ? { details: jsonSafe(view.selectedEdge.details) }
                : {}),
            }
          : null,
        inspectTool: "graph_get_view",
      };
    };
    surface.addEventListener("focus:collect-context", collect);
    return () => surface.removeEventListener("focus:collect-context", collect);
  }, [frame?.focused, content.title, captionKeyFor, surfaceRef]);

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
    <div ref={surfaceRef} data-graph-surface className="relative min-h-0 flex-1">
      {expandNotice && (
        <p role="status" className="text-muted-foreground absolute bottom-2 left-2 z-10 text-xs">
          {expandNotice}
        </p>
      )}
      <GraphView
        data={payload}
        onFullscreen={() => frame?.setFocused(!frame.focused)}
        isFullscreen={frame?.focused}
        onEdgeSelectionChange={(edge) => syncGraphEdgeContext(edge, `graph:${content.title}`)}
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
          syncGraphSelectionContext(
            node,
            `graph:${content.title}`,
            node ? captionKeyFor(node) : undefined,
          );
        }}
        inspectorActions={(node) => (
          <>
            <GraphContextPinButton node={node} captionKey={captionKeyFor(node)} />
            {graphExpander() && (
              // Expand loads directly; the agent's view of it is one click away.
              <button
                type="button"
                onClick={() => askAgentToExpand(node)}
                title="Ask the AI about this node's neighbours"
                aria-label="Ask AI"
                className="border-border hover:bg-muted focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-1 text-muted-foreground"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </>
        )}
        onQueryChange={(query) => graphWorkspaceStore.getState().setQuery(query)}
        onFilterChange={(labels) => graphWorkspaceStore.getState().setHiddenLabels(labels)}
      />
    </div>
  );
}
