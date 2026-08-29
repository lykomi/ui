import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { primaryLabel, type GraphEdge, type GraphNode } from "./model.ts";
import {
  FULL_CAPTION_SCALE,
  captionBudget,
  paintEdgeLabel,
  paintNode,
  paintNodePointerArea,
  type PositionedLink,
  type PositionedNode,
} from "./graph-canvas-paint.ts";
import { edgeTooltip, nodeTooltip } from "./graph-tooltip.ts";
import type { EngineLink, EngineNode, GraphModel } from "./use-graph-model.ts";
import type { GraphStyleMap } from "./use-graph-styling.ts";
import type { GraphTheme } from "./theme.ts";
import type { GraphViewState } from "./use-graph-view-state.ts";

/** Imperative controls the host can drive through a ref. */
export interface GraphCanvasHandle {
  zoomToFit: (durationMs?: number, padding?: number) => void;
  centerOn: (nodeId: string, durationMs?: number) => void;
  /** Re-run the force simulation from a hot state — the "untangle it" action. */
  reheat: () => void;
}

export interface GraphCanvasProps {
  model: GraphModel;
  styleMap: GraphStyleMap;
  theme: GraphTheme;
  state: GraphViewState;
  width: number;
  height: number;
  onExpandNode?: (node: GraphNode) => void;
  handleRef?: Ref<GraphCanvasHandle>;
  /** Skip the settle animation for `prefers-reduced-motion`. */
  reducedMotion?: boolean;
}

/** Matches the platform default well enough that the gesture feels native. */
const DOUBLE_CLICK_MS = 350;

/**
 * Upper bound on zoom.
 *
 * `zoomToFit` has no upper bound, so a two- or three-node result frames itself
 * at a scale where the nodes fill the panel like beach balls. Capping keeps a
 * small graph looking like a small graph, while leaving room to zoom into a
 * dense neighbourhood by hand.
 */
const MAX_ZOOM = 2.2;

/**
 * Breathing room around a fitted graph, in screen pixels.
 *
 * Generous on purpose: `zoomToFit` frames the node CENTRES, so a tight padding
 * clips the captions drawn beneath the outermost nodes — which is exactly
 * where the labels you most want to read tend to sit.
 */
const FIT_PADDING = 64;

/**
 * How long the simulation runs before freezing.
 *
 * force-graph's 15s default leaves a small graph visibly drifting long after
 * it has found its shape, which reads as the page being busy. Large graphs get
 * less, not more: they will never fully converge, and a slideshow of a
 * thousand nodes rearranging is worse than an imperfect but stable picture.
 */
const cooldownFor = (nodeCount: number) => (nodeCount > 600 ? 3500 : 6000);

/** How often to re-frame while the layout is still moving. */
const FIT_INTERVAL_MS = 150;
/** Keep re-framing a little past the cooldown so the final shape is included. */
const FIT_TAIL_MS = 600;

/**
 * Force tuning.
 *
 * force-graph's defaults are built for abstract network diagrams: weak
 * repulsion and a short link distance, which packs a labelled graph into a
 * knot where every caption overlaps its neighbours. These spread it out enough
 * that the captions have room, without stringing small graphs across the whole
 * canvas.
 *
 * Both scale with size — a 20-node graph wants more space per node than a
 * 1,000-node one, which would otherwise fly apart.
 */
function tuneForces(
  engine: ForceGraphMethods<EngineNode, EngineLink> | undefined,
  nodeCount: number,
  radiusOf: (node: EngineNode) => number,
): void {
  if (!engine) return;
  const spread = Math.max(0.5, Math.min(1, 60 / Math.max(nodeCount, 1)));
  const charge = engine.d3Force("charge");
  if (charge && typeof (charge as { strength?: unknown }).strength === "function") {
    const base = -120 * spread - 60;
    // Repulsion proportional to size. force-graph registers no collision
    // force, so without this a big hub and its caption sit on top of the
    // small nodes around it — and the hubs are exactly the nodes whose labels
    // you most want to read.
    (charge as unknown as { strength: (fn: (node: EngineNode) => number) => void }).strength(
      (node) => base * (0.7 + radiusOf(node) / 8),
    );
  }
  const link = engine.d3Force("link");
  if (link && typeof (link as { distance?: unknown }).distance === "function") {
    (link as unknown as { distance: (v: number) => void }).distance(28 * spread + 22);
  }
  engine.d3Force("graphCohesion", cohesionForce());
}

/**
 * A weak pull toward the origin.
 *
 * The link force only acts WITHIN a connected component, and charge pushes
 * everything apart — so a result with two components has nothing holding them
 * together. They drift to opposite corners, `zoomToFit` frames the empty space
 * between them, and a six-node answer renders as two specks with a void in the
 * middle. (Seen on "people who worked on more than one film": two clusters,
 * most of the panel empty.)
 *
 * Written by hand rather than importing `d3-force`: force-graph bundles its
 * own copy, and pulling in a second one to get `forceX` would ship the whole
 * module twice. A d3 force is just a function with an `initialize` hook.
 */
function cohesionForce(): (alpha: number) => void {
  let nodes: EngineNode[] = [];
  const force = (alpha: number) => {
    // Proportional to distance, so distant components are pulled hardest and
    // nodes already near the centre are barely touched.
    const k = alpha * 0.09;
    for (const node of nodes) {
      if (node.fx != null || node.fy != null) continue; // pinned: user's choice wins
      if (typeof node.x === "number") node.vx = (node.vx ?? 0) - node.x * k;
      if (typeof node.y === "number") node.vy = (node.vy ?? 0) - node.y * k;
    }
  };
  force.initialize = (initial: EngineNode[]) => {
    nodes = initial;
  };
  return force;
}

/**
 * The force-directed canvas.
 *
 * The ONLY module in this package that imports `react-force-graph-2d`, so the
 * engine can be code-split away from the data model and the surrounding chrome
 * (a guard test enforces the boundary). Everything it needs is passed in
 * already computed — it owns no state of its own beyond the engine handle.
 */
export function GraphCanvas({
  model,
  styleMap,
  theme,
  state,
  width,
  height,
  onExpandNode,
  handleRef,
  reducedMotion = false,
}: GraphCanvasProps) {
  const engineRef = useRef<ForceGraphMethods<EngineNode, EngineLink> | undefined>(undefined);

  useImperativeHandle(
    handleRef,
    () => ({
      zoomToFit: (durationMs = 400, padding = FIT_PADDING) =>
        engineRef.current?.zoomToFit(reducedMotion ? 0 : durationMs, padding),
      centerOn: (nodeId, durationMs = 400) => {
        const node = model.nodes.find((candidate) => candidate.id === nodeId);
        if (node && typeof node.x === "number" && typeof node.y === "number") {
          engineRef.current?.centerAt(node.x, node.y, reducedMotion ? 0 : durationMs);
        }
      },
      reheat: () => {
        engineRef.current?.d3ReheatSimulation();
      },
    }),
    [model.nodes, reducedMotion],
  );

  /**
   * Keep the whole graph in frame while the layout settles.
   *
   * Driven from React on an interval rather than from force-graph's
   * `onEngineTick` / `onEngineStop`: those callbacks do not fire through the
   * react-kapsule wrapper (verified in a browser — the imperative
   * `zoomToFit` works, the callbacks never run), so anything hung off them
   * silently never happens.
   *
   * Without this the first seconds show whatever fraction of the graph the
   * random initial layout put on screen, usually wildly zoomed in. Re-framing
   * as it forms means the layout is legible the whole time.
   *
   * It stops once the simulation has settled: a view that re-frames itself
   * after the user has panned somewhere is worse than one that never fits.
   * Re-runs on resize, because the panel is drag-resizable and has a
   * fullscreen toggle.
   */
  useEffect(() => {
    if (width === 0 || height === 0) return;
    tuneForces(engineRef.current, model.nodes.length, (node) => styleMap.styleForNode(node).radius);

    const deadline = Date.now() + cooldownFor(model.nodes.length) + FIT_TAIL_MS;
    // Fit immediately so nothing is off-screen even for one frame.
    engineRef.current?.zoomToFit(0, FIT_PADDING);
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timer);
        return;
      }
      engineRef.current?.zoomToFit(0, FIT_PADDING);
    }, FIT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [model, width, height, styleMap]);

  const {
    selection,
    hoveredId,
    matchedIds,
    hiddenLabels,
    pinnedIds,
    query,
    selectNode,
    selectEdge,
    setHoveredId,
    togglePinned,
  } = state;

  const isHidden = useCallback(
    (node: GraphNode) => hiddenLabels.has(primaryLabel(node)),
    [hiddenLabels],
  );

  /**
   * Select on click, expand on double-click.
   *
   * `react-force-graph-2d` exposes no double-click event — only click, right-click
   * and hover — so the gesture is reconstructed here. Bloom expands on
   * double-click and that is the muscle memory people bring, so "no library
   * support" is not a good enough reason to move it onto a different gesture.
   *
   * The first click still selects, which is what makes this feel right: the
   * inspector opens immediately and the expand lands on top of it.
   */
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);
  const handleNodeClick = useCallback(
    (node: EngineNode) => {
      const id = String(node.id);
      const now = Date.now();
      const previous = lastClickRef.current;
      lastClickRef.current = { id, at: now };
      selectNode(node);
      if (onExpandNode && previous && previous.id === id && now - previous.at <= DOUBLE_CLICK_MS) {
        lastClickRef.current = null;
        onExpandNode(node);
      }
    },
    [onExpandNode, selectNode],
  );

  // Recomputed only when the data or the styling changes — not per frame.
  const captioned = useMemo(
    () => captionBudget(model.nodes, (node) => styleMap.styleForNode(node as EngineNode).radius),
    [model.nodes, styleMap],
  );

  const nodeCanvasObject = useCallback(
    (node: PositionedNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as EngineNode;
      const isSelected = selection.node?.id === graphNode.id;
      const isHovered = hoveredId === graphNode.id;
      const isMatch = query.length > 0 && matchedIds.has(graphNode.id);
      paintNode(
        node,
        {
          style: styleMap.styleForNode(graphNode),
          selected: isSelected,
          hovered: isHovered,
          // A search dims the misses so the hits stand out; with no search
          // running, nothing is dimmed.
          dimmed: query.length > 0 && !isMatch,
          pinned: pinnedIds.has(graphNode.id),
          // Whatever the user is pointing at or searching for is always
          // named, however far out they are.
          showCaption:
            isSelected ||
            isHovered ||
            isMatch ||
            globalScale >= FULL_CAPTION_SCALE ||
            captioned.has(graphNode.id),
        },
        theme,
        ctx,
        globalScale,
      );
    },
    [styleMap, selection.node?.id, hoveredId, query, matchedIds, pinnedIds, theme, captioned],
  );

  const nodePointerAreaPaint = useCallback(
    (node: PositionedNode, color: string, ctx: CanvasRenderingContext2D) => {
      paintNodePointerArea(node, color, styleMap.styleForNode(node as EngineNode), ctx);
    },
    [styleMap],
  );

  const linkCanvasObject = useCallback(
    (link: PositionedLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Only worth drawing while the graph is sparse enough to read.
      if (model.links.length > 300) return;
      paintEdgeLabel(link, (link as EngineLink).type ?? "", theme, ctx, globalScale);
    },
    [model.links.length, theme],
  );

  return (
    <ForceGraph2D<EngineNode, EngineLink>
      ref={engineRef}
      graphData={{ nodes: model.nodes, links: model.links }}
      width={width}
      height={height}
      backgroundColor="transparent"
      // Cap the zoom. `zoomToFit` has no upper bound, so a three-node result
      // frames itself at a scale where the nodes fill the panel like beach
      // balls. Capping keeps a small graph looking like a small graph.
      maxZoom={MAX_ZOOM}
      nodeRelSize={4}
      nodeVisibility={(node) => !isHidden(node)}
      // MUST return an element, never a string: force-graph's tooltip assigns
      // a string via innerHTML, which would execute markup stored in the graph.
      nodeLabel={((node: EngineNode) => nodeTooltip(node, styleMap)) as never}
      linkLabel={((link: EngineLink) => edgeTooltip(link as unknown as GraphEdge)) as never}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkCanvasObjectMode={() => "after"}
      linkCanvasObject={linkCanvasObject}
      // border is too faint to follow across a canvas; mutedForeground reads
      // as a line without competing with the nodes.
      linkColor={() => theme.mutedForeground}
      linkWidth={1.1}
      linkDirectionalArrowLength={5}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={() => theme.mutedForeground}
      d3VelocityDecay={0.32}
      onNodeClick={handleNodeClick}
      onNodeRightClick={(node) => togglePinned(String(node.id))}
      onLinkClick={(link) => selectEdge(link as unknown as GraphEdge)}
      onNodeHover={(node) => setHoveredId(node ? String(node.id) : null)}
      onBackgroundClick={() => state.clearSelection()}
      onNodeDragEnd={(node) => {
        // Dragging pins: the position the user chose is the point of dragging.
        node.fx = node.x;
        node.fy = node.y;
        if (!pinnedIds.has(String(node.id))) togglePinned(String(node.id));
      }}
      cooldownTime={reducedMotion ? 0 : cooldownFor(model.nodes.length)}
    />
  );
}

export default GraphCanvas;
