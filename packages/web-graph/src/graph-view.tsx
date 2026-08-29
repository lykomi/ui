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
import { primaryLabel, type GraphNode, type GraphPayload } from "./model.ts";
import { GraphLegend } from "./graph-legend.tsx";
import { GraphInspector, GRAPH_INSPECTOR_WIDTH } from "./graph-inspector.tsx";
import { GraphToolbar } from "./graph-toolbar.tsx";
import { GraphEmptyState, GraphLossNotice } from "./graph-notice.tsx";
import { GraphTable } from "./graph-table.tsx";
import { useElementSize } from "./use-element-size.ts";
import { useGraphModel, DEFAULT_LIMITS, type GraphModelLimits } from "./use-graph-model.ts";
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
  zoomToFit: (durationMs?: number, padding?: number) => void;
  centerOn: (nodeId: string, durationMs?: number) => void;
  /** Smallest pan that brings a node into view; a no-op if it already is. */
  reveal: (nodeId: string, durationMs?: number) => void;
  search: (term: string) => void;
  select: (nodeId: string | null) => void;
  unpinAll: () => void;
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
  /** Fires when the search term changes, whoever changed it. */
  onQueryChange?: (query: string) => void;
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
  onQueryChange,
  inspectorActions,
  forceTable = false,
  handleRef,
}: GraphViewProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
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

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const node of model.nodes) {
      const label = primaryLabel(node);
      out[label] = (out[label] ?? 0) + 1;
    }
    return out;
  }, [model.nodes]);

  const { selection, selectNode } = state;

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
  const notifiedSelection = useRef<GraphNode | null>(selection.node);
  useEffect(() => {
    if (notifiedSelection.current === selection.node) return;
    notifiedSelection.current = selection.node;
    onSelectionChange?.(selection.node);
  }, [selection.node, onSelectionChange]);

  /**
   * How much of the canvas the details drawer covers.
   *
   * Framing reads this so a node is centred in what the user can SEE. Zero
   * whenever the drawer is closed, so an inline card is unaffected.
   */
  const showsInspector = variant === "full" && Boolean(selection.node || selection.edge);
  const inspectorInset = showsInspector ? Math.min(GRAPH_INSPECTOR_WIDTH, size.width * 0.85) : 0;

  const notifiedQuery = useRef(state.query);
  useEffect(() => {
    if (notifiedQuery.current === state.query) return;
    notifiedQuery.current = state.query;
    onQueryChange?.(state.query);
  }, [state.query, onQueryChange]);

  useImperativeHandle(
    handleRef,
    () => ({
      zoomToFit: (durationMs, padding) => canvasRef.current?.zoomToFit(durationMs, padding),
      centerOn: (nodeId, durationMs) =>
        afterDrawer(() => canvasRef.current?.centerOn(nodeId, durationMs)),
      reveal: (nodeId, durationMs) =>
        afterDrawer(() => canvasRef.current?.reveal(nodeId, durationMs)),
      search: (term) => state.setQuery(term),
      select: (nodeId) =>
        selectNode(nodeId === null ? null : (model.nodes.find((n) => n.id === nodeId) ?? null)),
      unpinAll: () => state.unpinAll(),
    }),
    [model.nodes, selectNode, state],
  );

  // No canvas in jsdom, and `forceTable` is the print/a11y path.
  const useTable = forceTable || typeof HTMLCanvasElement === "undefined";
  const isEmpty = model.nodes.length === 0;

  return (
    <div
      ref={setContainer}
      className={cn("flex min-h-0 flex-col gap-2", className)}
      style={{ height }}
    >
      <GraphToolbar
        query={state.query}
        onQueryChange={state.setQuery}
        matchCount={state.matchedIds.size}
        nodeCount={model.nodes.length}
        edgeCount={model.links.length}
        onZoomToFit={() => canvasRef.current?.zoomToFit()}
        onReheat={() => canvasRef.current?.reheat()}
        pinnedCount={state.pinnedIds.size}
        onUnpinAll={state.unpinAll}
        className="shrink-0"
      />

      <GraphLegend
        styleMap={styleMap}
        counts={counts}
        hiddenLabels={state.hiddenLabels}
        onToggleLabel={state.toggleLabel}
        onShowAll={state.showAllLabels}
        className="shrink-0"
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
              model={model}
              styleMap={styleMap}
              onSelectNode={selectNode}
              className="h-full"
            />
          ) : (
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
          )}

          {showsInspector && (
            <GraphInspector
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
