import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  deepEqual,
  primaryLabel,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "./model.ts";
import { GraphLegend } from "./graph-legend.tsx";
import { GraphInspector, GRAPH_INSPECTOR_WIDTH } from "./graph-inspector.tsx";
import { GraphToolbar } from "./graph-toolbar.tsx";
import { GraphEmptyState, GraphLossNotice } from "./graph-notice.tsx";
import { GraphTable } from "./graph-table.tsx";
import { useElementSize } from "./use-element-size.ts";
import {
  endpointId,
  useGraphModel,
  DEFAULT_LIMITS,
  type GraphModelLimits,
} from "./use-graph-model.ts";
import { useGraphStyling, type GraphStyling } from "./use-graph-styling.ts";
import { useGraphTheme } from "./use-graph-theme.ts";
import { useGraphViewState } from "./use-graph-view-state.ts";
import type { GraphCanvasHandle } from "./graph-canvas.tsx";

/**
 * The engine is code-split.
 *
 * `react-force-graph-2d` pulls in force-graph and the d3 force/zoom/drag
 * stack. A chat app that shows one graph card in ten conversations should not
 * pay for that on first paint, and a host that only wants the payload types
 * should not pay for it at all.
 */
const GraphCanvas = lazy(() => import("./graph-canvas.tsx"));

export interface GraphViewHandle {
  zoomToFit: (durationMs?: number) => void;
  centerOn: (nodeId: string, durationMs?: number) => void;
  /** Smallest pan that brings a node into view; a no-op if it already is. */
  reveal: (nodeId: string, durationMs?: number) => void;
  search: (term: string) => void;
  /**
   * Select a node by id, or clear with `null`. Returns whether it worked:
   * a node in the payload can still be absent from what is RENDERED, because
   * `selectConnectedCore` caps a large graph — and a caller that assumed
   * success would tell the user about a node that is not on screen.
   */
  select: (nodeId: string | null) => boolean;
  unpinAll: () => void;
  /**
   * What the view is actually showing — the single honest answer to "what is
   * on screen", which is why anything REPORTING on the graph reads it.
   *
   * `nodes`/`edges` are what is DRAWN: the payload capped to the connected
   * core, then filtered by the legend. Counting the payload instead described
   * a graph the user was not looking at, in two directions at once — the
   * agent naming nodes the cap had dropped, and a hidden label still counted.
   *
   * It also exists because the view OUTLIVES the workspace it publishes to.
   * Closing the tool panel disconnects the workspace but does not unmount this
   * component, so on reopening, the drawer and the search box still show what
   * they showed — while the change callbacks, which fire only on change, have
   * nothing to report. A host reconnecting reads this instead of guessing.
   */
  getViewState: () => GraphViewState_Reported;
}

/** What {@link GraphViewHandle.getViewState} reports. */
export interface GraphViewState_Reported {
  selection: GraphNode | null;
  /** A relationship can be selected too, and the drawer shows it. */
  selectedEdge: GraphEdge | null;
  query: string;
  hiddenLabels: string[];
  /** Whether the selected node is among the DRAWN nodes. False when none. */
  selectionDrawn: boolean;
  /** Nodes actually drawn: capped to the connected core, legend filter applied. */
  nodes: GraphNode[];
  /** Relationships actually drawn, re-filtered against the surviving nodes. */
  edges: GraphEdge[];
  /** Whether anything was dropped to get here — the cap, or a dangling edge. */
  lossy: boolean;
}

/**
 * Is there a canvas that can actually be DRAWN on?
 *
 * `typeof HTMLCanvasElement === "undefined"` was the wrong question. A stock
 * jsdom defines the class and then throws "Not implemented" from
 * `getContext`, so a consumer's test rendering `GraphView` took the engine
 * path and hit unimplemented APIs instead of the readable table this fallback
 * exists to give them. Asking for the context answers what the caller meant.
 *
 * Probed once: the answer cannot change within a page, and this is read on
 * every render.
 */
let usableCanvas: boolean | undefined;
function hasUsableCanvas(): boolean {
  if (usableCanvas !== undefined) return usableCanvas;
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") {
    usableCanvas = false;
    return usableCanvas;
  }
  try {
    usableCanvas = document.createElement("canvas").getContext("2d") !== null;
  } catch {
    usableCanvas = false;
  }
  return usableCanvas;
}

export interface GraphViewProps {
  data: GraphPayload;
  /** `inline` is the compact card form; `full` adds the details drawer. */
  variant?: "inline" | "full";
  height?: number | string;
  className?: string;
  styling?: GraphStyling;
  limits?: GraphModelLimits;
  /**
   * Called when the user asks to expand a node (double-click, or the
   * inspector's Expand button). The host runs whatever query that means and
   * feeds a larger payload back in through `data` — the view never queries.
   */
  onExpandNode?: (node: GraphNode) => void;
  onSelectionChange?: (node: GraphNode | null) => void;
  onEdgeSelectionChange?: (edge: GraphEdge | null) => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  /** Fires when the search term changes, whoever changed it. */
  onQueryChange?: (query: string) => void;
  /**
   * Fires when the legend filter changes: the labels currently switched OFF.
   *
   * Hosts publish it so anything REPORTING on the graph agrees with what is
   * drawn — a hidden label's nodes and relationships are not on screen, and
   * counting them describes a screen nobody is looking at.
   */
  onFilterChange?: (hiddenLabels: readonly string[]) => void;
  /**
   * Extra footer actions for the details drawer, rendered for the selected
   * node. The host owns them — the view has no opinion about what "pin to
   * chat" or "open the record" mean.
   */
  inspectorActions?: (node: GraphNode) => ReactNode;
  /** Render the table instead of the canvas. Used by tests and print. */
  forceTable?: boolean;
  handleRef?: Ref<GraphViewHandle>;
}

/**
 * Run after the frame that opens the details drawer.
 *
 * Callers frame a node right after selecting it (`graph_select_node` does
 * exactly that), and it is the selection that opens the drawer — so on this
 * tick the width deciding what is visible does not exist yet. Framing now
 * would put the node underneath the panel about to describe it.
 */
function afterDrawer(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else run();
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * An interactive, force-directed graph.
 *
 * Source-agnostic by construction: it takes a {@link GraphPayload} and knows
 * nothing about where the nodes came from. Expansion is a callback, so the view
 * never issues a query of its own.
 */
export function GraphView({
  data,
  variant = "full",
  height = 420,
  className,
  styling,
  limits = DEFAULT_LIMITS,
  onExpandNode,
  onSelectionChange,
  onEdgeSelectionChange,
  onFullscreen,
  isFullscreen,
  onQueryChange,
  onFilterChange,
  inspectorActions,
  forceTable = false,
  handleRef,
}: GraphViewProps) {
  const [inspectorWidth, setInspectorWidth] = useState(GRAPH_INSPECTOR_WIDTH);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullscreen(Boolean(container && document.fullscreenElement === container));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [container]);
  const toggleFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else await container?.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  };
  // The canvas is opaque to a screen reader; the table is the same graph as
  // real DOM. Off by default, one button away.
  const [tableRequested, setTableRequested] = useState(false);
  const [canvasHost, setCanvasHost] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const theme = useGraphTheme(container);
  const reducedMotion = usePrefersReducedMotion();

  const model = useGraphModel(data, limits);
  const styleMap = useGraphStyling(data, theme, styling);
  const captionOf = useCallback(
    (node: GraphNode) => styleMap.styleForNode(node).caption,
    [styleMap],
  );
  const state = useGraphViewState(data, captionOf);
  const size = useElementSize(canvasHost);

  // A `Map`, not `{}`. Labels come from the payload and the payload is
  // source-neutral — nothing stops a graph from having a label called
  // `constructor` or `toString`, and both the write (`out[label] ?? 0`) and
  // the legend\'s read would then find an inherited function where a count
  // belongs, so the chip shows a stringified function or `NaN`.
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const node of model.nodes) {
      const label = primaryLabel(node);
      out.set(label, (out.get(label) ?? 0) + 1);
    }
    return out;
  }, [model.nodes]);

  const { selection, selectNode } = state;

  /**
   * The graph as DRAWN: the capped model, minus anything the legend hides.
   *
   * One derivation, so the canvas, the readable table and the agent cannot
   * disagree about what is on screen. Hiding a label takes its relationships
   * with it — the canvas already does that through `linkVisibility`, and the
   * table showed them until this existed.
   */
  const visibleModel = useMemo(() => {
    if (state.hiddenLabels.size === 0) return model;
    const nodes = model.nodes.filter((node) => !state.hiddenLabels.has(primaryLabel(node)));
    const ids = new Set(nodes.map((node) => node.id));
    const links = model.links.filter((link) => {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      return source !== undefined && target !== undefined && ids.has(source) && ids.has(target);
    });
    return { ...model, nodes, links };
  }, [model, state.hiddenLabels]);

  /**
   * Report changes, and ONLY changes.
   *
   * A host almost always passes these as inline arrows, so their identity is
   * new on every render and an effect that lists them as dependencies re-runs
   * every render — firing "the selection changed" when it did not. That is
   * fine until a listener writes to a store the host also reads, at which
   * point the notification causes the render that causes the notification.
   * (It did: routing the selection into the chat context deadlocked the panel
   * with "Maximum update depth exceeded" the moment a node was selected.)
   *
   * Debouncing or stabilising callbacks host-side would paper over it. The
   * component's own contract is the right place to hold the line: a change
   * callback fires when the value changes.
   */
  /**
   * Identity is not enough to say the selection is unchanged.
   *
   * `reconcileGraphModel` refreshes a node's `labels`/`caption`/`properties`
   * IN PLACE, precisely so the simulation keeps its position — so after a
   * merge that rewrote the selected node, the object is the same object with
   * different data. The drawer re-rendered and showed the new values; the
   * listener never fired, and `syncGraphSelectionContext` snapshots
   * `properties` into the chat context, so the agent went on answering about
   * "this node" from the values before the write.
   *
   * Comparing the VALUE keeps the loop-prevention this guard exists for — it
   * changes only when the data actually changes — while noticing that case.
   * Held as a value rather than a serialized signature so nothing stringifies
   * a node\'s whole property bag on every render, and so a `bigint` property
   * cannot collide with the string of its own digits.
   */
  const selectionValue = selection.node
    ? [
        selection.node.id,
        selection.node.labels ?? [],
        selection.node.caption ?? null,
        selection.node.properties ?? {},
      ]
    : null;
  const edgeValue = selection.edge
    ? {
        ...selection.edge,
        source: endpointId(selection.edge.source) ?? "",
        target: endpointId(selection.edge.target) ?? "",
      }
    : null;
  const notifiedEdge = useRef(edgeValue);
  useEffect(() => {
    if (deepEqual(notifiedEdge.current, edgeValue)) return;
    notifiedEdge.current = edgeValue;
    onEdgeSelectionChange?.(edgeValue);
  });
  const notifiedSelection = useRef(selectionValue);
  useEffect(() => {
    if (deepEqual(notifiedSelection.current, selectionValue)) return;
    notifiedSelection.current = selectionValue;
    onSelectionChange?.(selection.node);
    // Deliberately runs on EVERY render, gated by the comparison above rather
    // than by a dependency list. The case this exists to catch is
    // `reconcileGraphModel` refreshing the selected node IN PLACE — the object
    // is identical, so no dependency can see it; only re-reading the value can.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  /**
   * How much of the canvas the details drawer covers.
   *
   * Framing reads this so a node is centred in what the user can SEE. Zero
   * whenever the drawer is closed, so an inline card is unaffected.
   */
  const showsInspector = variant === "full" && Boolean(selection.node || selection.edge);

  /**
   * Matches AMONG THE DRAWN NODES.
   *
   * `matchedIds` is computed from the payload, which is what the canvas needs
   * — it dims by id and only ever paints visible nodes anyway. The toolbar is
   * different: it states a number to the user. Counting the payload let it
   * report "1 match" with every node on screen dimmed and nothing found,
   * whenever the only hit was one the render cap dropped or the legend hid.
   */
  const visibleMatchCount = useMemo(() => {
    if (state.matchedIds.size === 0) return 0;
    return visibleModel.nodes.reduce(
      (count, node) => (state.matchedIds.has(node.id) ? count + 1 : count),
      0,
    );
  }, [state.matchedIds, visibleModel.nodes]);
  const inspectorInset = showsInspector ? Math.min(inspectorWidth, size.width * 0.85) : 0;
  const selectionDrawn = visibleModel.nodes.some((node) => node.id === selection.node?.id);
  useEffect(() => {
    if (!selection.node || !selectionDrawn || variant !== "full") return;
    const id = selection.node.id;
    let cancelled = false;
    afterDrawer(() => {
      if (!cancelled) canvasRef.current?.reveal(id);
    });
    return () => {
      cancelled = true;
    };
  }, [selection.node?.id, selectionDrawn, variant, inspectorInset]);

  const notifiedQuery = useRef(state.query);
  useEffect(() => {
    if (notifiedQuery.current === state.query) return;
    notifiedQuery.current = state.query;
    onQueryChange?.(state.query);
  }, [state.query, onQueryChange]);

  // Same shape, same reason: hosts pass an inline arrow, so the change has to
  // be detected from the VALUE. Sorted so a Set rebuilt in a different order
  // is not reported as a change.
  const hiddenLabels = useMemo(
    () => [...state.hiddenLabels].sort().join("\u0000"),
    [state.hiddenLabels],
  );
  const notifiedHidden = useRef(hiddenLabels);
  useEffect(() => {
    if (notifiedHidden.current === hiddenLabels) return;
    notifiedHidden.current = hiddenLabels;
    onFilterChange?.(hiddenLabels.length === 0 ? [] : hiddenLabels.split("\u0000"));
  }, [hiddenLabels, onFilterChange]);

  /**
   * Everything the handle answers from, refreshed every render.
   *
   * The handle itself must be ONE object for the life of the view.
   * `GraphPanel` stores `handleRef.current` in the workspace when it connects
   * and reconnects only on a payload, title or visibility change — so a handle
   * rebuilt whenever the view state changed left the workspace, and every
   * client tool through it, holding a closure over the view as it was when the
   * panel opened. `graph_get_view` would answer without the search the user
   * had since typed; `graph_select_node` would accept a node hidden after
   * connection. Nothing surfaced it, because a merge changes the payload and
   * so happens to reconnect.
   *
   * `useGraphViewState` returns a fresh object literal every render, which is
   * what made `state` in a dependency list mean "every render".
   */
  const live = useRef({ model, visibleModel, state, selectNode });
  // Assigned during render on purpose: the handle's methods are only ever
  // called imperatively — by the host, or by a client tool the agent ran —
  // never while rendering, so there is nothing here to tear. Deferring it to
  // an effect would leave the handle a render behind instead.
  live.current = { model, visibleModel, state, selectNode };

  useImperativeHandle(
    handleRef,
    () => ({
      zoomToFit: (durationMs) => canvasRef.current?.zoomToFit(durationMs),
      centerOn: (nodeId, durationMs) =>
        afterDrawer(() => canvasRef.current?.centerOn(nodeId, durationMs)),
      reveal: (nodeId, durationMs) =>
        afterDrawer(() => canvasRef.current?.reveal(nodeId, durationMs)),
      search: (term) => live.current.state.setQuery(term),
      select: (nodeId) => {
        const { visibleModel: drawn, selectNode: choose } = live.current;
        if (nodeId === null) {
          choose(null);
          return true;
        }
        // The DRAWN nodes: a label hidden in the legend is as absent from the
        // canvas as one the render cap dropped, and reporting success for it
        // opens a drawer describing something invisible.
        const node = drawn.nodes.find((n) => n.id === nodeId) ?? null;
        if (node) choose(node);
        return node !== null;
      },
      unpinAll: () => live.current.state.unpinAll(),
      getViewState: () => {
        const { state, visibleModel, model } = live.current;
        return {
          selection: state.selection.node,
          // A legend filter is a view toggle, not a deletion, so hiding a
          // selected node\'s label does NOT clear the selection — the drawer
          // stays open and its properties are still on screen, which is what
          // the user is reading. But `nodes` below excludes it, so reporting
          // the selection bare made this result contradict itself. Saying
          // whether it is drawn is what lets the agent be precise: "selected,
          // though its label is hidden" rather than a node that is somehow both
          // selected and absent.
          selectionDrawn: state.selection.node
            ? visibleModel.nodes.some((node) => node.id === state.selection.node?.id)
            : false,
          query: state.query,
          hiddenLabels: [...state.hiddenLabels],
          nodes: visibleModel.nodes,
          // Normalised, because force-graph REPLACES a link's `source`/`target`
          // with the node objects once it has run — so handing these out raw
          // put whole simulation objects, mutable layout fields and all, where
          // a caller expects an id.
          edges: visibleModel.links.map((link) => ({
            ...(link as unknown as GraphEdge),
            source: endpointId(link.source) ?? "",
            target: endpointId(link.target) ?? "",
          })),
          selectedEdge: state.selection.edge
            ? {
                ...state.selection.edge,
                source: endpointId(state.selection.edge.source) ?? "",
                target: endpointId(state.selection.edge.target) ?? "",
              }
            : null,
          lossy: model.lossy,
        };
      },
    }),
    // Empty ON PURPOSE — see `live` above. One handle for the life of the
    // view; everything it answers from is read at call time.
    [],
  );

  // `forceTable` is the print path; `tableRequested` is the user asking, from
  // the toolbar; `noCanvas` is the environment having nothing to draw on.
  const noCanvas = !hasUsableCanvas();
  const useTable = forceTable || noCanvas || tableRequested;
  const isEmpty = model.nodes.length === 0;

  return (
    <div
      ref={setContainer}
      className={cn(
        "flex min-h-0 flex-col gap-2 bg-background text-foreground",
        fullscreen && "p-4",
        className,
      )}
      style={{ height }}
    >
      <GraphToolbar
        query={state.query}
        onQueryChange={state.setQuery}
        matchCount={visibleMatchCount}
        // The DRAWN graph, like every other count on this screen. Reading the
        // capped-but-unfiltered model meant switching a label off left the
        // toolbar saying "2 nodes · 1 rels" beside a canvas showing one node
        // and no relationships.
        nodeCount={visibleModel.nodes.length}
        edgeCount={visibleModel.links.length}
        onZoomToFit={() => canvasRef.current?.zoomToFit()}
        onReheat={() => canvasRef.current?.reheat()}
        onFullscreen={
          onFullscreen ?? (container?.requestFullscreen ? () => void toggleFullscreen() : undefined)
        }
        fullscreen={isFullscreen ?? fullscreen}
        pinnedCount={state.pinnedIds.size}
        onUnpinAll={state.unpinAll}
        showsTable={useTable}
        // No control where there is no choice: a host that pinned the table
        // with `forceTable`, or an environment with no canvas to go back to.
        onToggleTable={
          forceTable || noCanvas ? undefined : () => setTableRequested((shown) => !shown)
        }
        className="shrink-0"
      />

      {fullscreenError && (
        <p role="alert" className="text-sm text-destructive">
          Fullscreen could not open. Please try again.
        </p>
      )}
      <GraphLegend
        styleMap={styleMap}
        counts={counts}
        hiddenLabels={state.hiddenLabels}
        onToggleLabel={state.toggleLabel}
        onShowAll={state.showAllLabels}
        className="shrink-0 pt-2"
      />

      {(model.lossy || data.truncated) && (
        <GraphLossNotice
          loss={model.loss}
          truncatedByProducer={data.truncated}
          className="shrink-0"
        />
      )}

      {/* The drawer lives INSIDE this box, over the canvas. Beside it, the
          details rail would take its width from the graph for as long as
          anything is selected — so the click that means "show me more" would
          also be the click that shrinks what you are looking at. */}
      <div className="flex min-h-0 flex-1">
        <div
          ref={setCanvasHost}
          className="border-border bg-background relative min-h-0 flex-1 overflow-hidden rounded-lg border"
        >
          {isEmpty ? (
            <GraphEmptyState />
          ) : useTable ? (
            <GraphTable
              model={visibleModel}
              styleMap={styleMap}
              onSelectNode={selectNode}
              onSelectEdge={state.selectEdge}
              className="h-full"
            />
          ) : (
            // `role="img"` wraps the CANVAS ONLY. ARIA exposes the descendants
            // of an image as presentational, so with this on the box that also
            // holds `GraphInspector`, selecting a node deleted the whole
            // drawer — its dialog, its property rows, its Pin/Freeze/Expand
            // controls — from the accessibility tree, at exactly the moment
            // the user asked to inspect something.
            //
            // The canvas itself genuinely is one opaque element to a screen
            // reader: the nodes and relationships are pixels, and no labelling
            // changes that. So the region says what it holds and where the
            // readable form is; the toolbar's button is what gets you there.
            <div
              role="img"
              onWheelCapture={() => canvasRef.current?.cancelAutoFit()}
              onPointerDownCapture={() => canvasRef.current?.cancelAutoFit()}
              aria-label={
                // Same numbers the sighted user is given, for the same reason.
                `Graph: ${visibleModel.nodes.length} nodes, ${visibleModel.links.length} relationships. ` +
                `Use "Show as a table" for a readable version.`
              }
              className="absolute inset-0"
            >
              <Suspense fallback={<GraphEmptyState message="Loading graph…" />}>
                {size.width > 0 && size.height > 0 && (
                  <GraphCanvas
                    model={model}
                    styleMap={styleMap}
                    theme={theme}
                    state={state}
                    width={size.width}
                    height={size.height}
                    onExpandNode={onExpandNode}
                    insetRight={inspectorInset}
                    handleRef={canvasRef}
                    reducedMotion={reducedMotion}
                  />
                )}
              </Suspense>
            </div>
          )}

          {showsInspector && (
            <GraphInspector
              width={inspectorWidth}
              maxWidth={size.width > 0 ? Math.min(640, size.width * 0.85) : 640}
              onWidthChange={setInspectorWidth}
              selection={selection}
              colorForLabel={styleMap.colorForLabel}
              captionOf={captionOf}
              onClose={state.clearSelection}
              onExpandNode={onExpandNode}
              onToggleFrozen={(node) => state.togglePinned(node.id)}
              isFrozen={(node) => state.pinnedIds.has(node.id)}
              actions={selection.node && inspectorActions ? inspectorActions(selection.node) : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
