import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { edgeCaption, primaryLabel, type GraphEdge, type GraphNode } from "./model.ts";
import {
  paintEdgeLabel,
  paintNode,
  paintNodePointerArea,
  truncateCaption,
  type PositionedLink,
  type PositionedNode,
} from "./graph-canvas-paint.ts";
import { edgeTooltip, nodeTooltip } from "./graph-tooltip.ts";
import {
  LabelTier,
  captionRect,
  createCaptionMeasurer,
  edgeLabelRect,
  nodeRect,
  placeLabels,
  type LabelCandidate,
} from "./caption-placement.ts";
import type { EngineLink, EngineNode, GraphModel } from "./use-graph-model.ts";
import type { GraphStyleMap } from "./use-graph-styling.ts";
import type { GraphTheme } from "./theme.ts";
import type { GraphViewState } from "./use-graph-view-state.ts";

/** Imperative controls the host can drive through a ref. */
export interface GraphCanvasHandle {
  /** Frame the whole graph. Padding is not a parameter: the fit has to
   *  account for the details drawer, which only the canvas knows about. */
  zoomToFit: (durationMs?: number) => void;
  /** Bring a node to the centre of the VISIBLE area — see `insetRight`. */
  centerOn: (nodeId: string, durationMs?: number) => void;
  /**
   * Bring a node into view with the SMALLEST pan that does it, and not at all
   * if it is already comfortably visible.
   */
  reveal: (nodeId: string, durationMs?: number) => void;
  /** Re-run the force simulation from a hot state — the "untangle it" action. */
  reheat: () => void;
  /** Stop automatic framing after the user starts navigating the canvas. */
  cancelAutoFit: () => void;
}

export interface GraphCanvasProps {
  model: GraphModel;
  styleMap: GraphStyleMap;
  theme: GraphTheme;
  state: GraphViewState;
  width: number;
  height: number;
  onExpandNode?: (node: GraphNode) => void;
  /**
   * Pixels of the canvas's right edge covered by an overlay (the details
   * drawer). Framing has to know: a node centred under the drawer is a node
   * the user selected and then could not see.
   */
  insetRight?: number;
  handleRef?: Ref<GraphCanvasHandle>;
  /** Skip the settle animation for `prefers-reduced-motion`. */
  reducedMotion?: boolean;
  /** How nodes are arranged; a hierarchy needs a graph without cycles. */
  layout?: GraphLayout;
  /** The graph has a cycle, so the hierarchy cannot be drawn: fall back. */
  onLayoutUnavailable?: () => void;
}

/** Force-directed, or a hierarchy: top-down, left to right, or radial. */
export type GraphLayout = "force" | "tree" | "tree-lr" | "radial";

/** Matches the platform default well enough that the gesture feels native. */
const DOUBLE_CLICK_MS = 350;

/**
 * Upper bound on zoom by hand: close enough to read a dense neighbourhood's
 * labels. Framing has its own, lower bound (`FIT_MAX_ZOOM`).
 */
const MAX_ZOOM = 8;

/**
 * Upper bound on framing. `zoomToFit` has none, so a two- or three-node result
 * framed itself at a scale where the nodes filled the panel like beach balls;
 * capping the FIT keeps a small graph looking small without stopping anyone
 * from zooming in by hand.
 */
const FIT_MAX_ZOOM = 2.2;

/** Line width and arrow length by emphasis, in graph units. */
const EDGE_WIDTH = { strong: 1.8, normal: 1.1, muted: 0.8 } as const;
const EDGE_ARROW = { strong: 7, normal: 5, muted: 4 } as const;

/** What each layout asks of the engine: none is the force layout. */
const DAG_MODE: Record<GraphLayout, "td" | "lr" | "radialout" | undefined> = {
  force: undefined,
  tree: "td",
  "tree-lr": "lr",
  radial: "radialout",
};

/**
 * How far inside the visible edge a revealed node must sit.
 *
 * Bigger than it looks necessary because captions are drawn BELOW their
 * node: a node exactly on the edge has a legible dot and an unreadable name.
 */
const REVEAL_MARGIN = 48;

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

/**
 * Ticks to run before the first paint when the user has asked for no motion.
 *
 * These are synchronous, so the number is a budget rather than a quality
 * target: enough for the layout to read as a graph, capped so a large result
 * cannot freeze the tab. d3-force is mostly converged well before 300.
 */
const warmupFor = (nodeCount: number) => (nodeCount > 600 ? 120 : 300);

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
/** Namespaces edge labels in the placement set, which node ids also live in. */
const EDGE_LABEL_PREFIX = "edge:";

/** Set equality by membership — cheaper than rebuilding and re-rendering. */
/**
 * How often the caption placement may be recomputed, in milliseconds.
 *
 * Driven from `onRenderFramePre`, which fires ~60 times a second, so it needs a
 * throttle. Ten passes a second is imperceptible for labels appearing and
 * disappearing, and the placement is skipped entirely when it comes out the
 * same (see `sameIds`), so a settled graph costs a cheap scan and no renders.
 */
const CAPTION_INTERVAL_MS = 100;

/** Set equality by membership — cheaper than rebuilding and re-rendering. */
/**
 * TEMPORARY probe: does `onRenderFramePre` actually fire?
 *
 * `onEngineTick` and `onEngineStop` are in the same typings and never run
 * through the react-kapsule wrapper, so the frame hook cannot be assumed to
 * work either. Logs once and gets deleted along with this comment as soon as
 * the answer is recorded in AGENTS.md.
 */
let framesSeen = 0;
function probeFrameHook(): void {
  framesSeen += 1;
  if (framesSeen === 1 || framesSeen === 60) {
    console.info(`[foundry-graph probe] onRenderFramePre fired ${framesSeen}x`);
  }
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function cohesionForce() {
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
  insetRight = 0,
  handleRef,
  reducedMotion = false,
  layout = "force",
  onLayoutUnavailable,
}: GraphCanvasProps) {
  const engineRef = useRef<ForceGraphMethods<EngineNode, EngineLink> | undefined>(undefined);
  const hiddenLabelsRef = useRef(state.hiddenLabels);
  hiddenLabelsRef.current = state.hiddenLabels;
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const insetRightRef = useRef(insetRight);
  insetRightRef.current = insetRight;
  const autoFitCancelledRef = useRef(false);

  /**
   * Frame the graph into what the user can SEE, not into the whole canvas.
   *
   * `zoomToFit` knows nothing about the details drawer, so a fit ran while one
   * is open settles half the graph underneath it — and because a merge changes
   * the model, the fit loop it restarts would undo the `reveal` that had just
   * brought the selected node clear. Its padding is uniform, so the extra room
   * it leaves on the other three sides is corrected by nudging the camera.
   */
  const fit = useCallback((durationMs = 0) => {
    const engine = engineRef.current;
    if (!engine) return;
    const inset = insetRightRef.current;
    // Framed here rather than by `zoomToFit`, which has no upper bound: the
    // fit is capped (`FIT_MAX_ZOOM`) while the zoom by hand is not.
    const box = engine.getGraphBbox((node) => !hiddenLabelsRef.current.has(primaryLabel(node)));
    const { width: w, height: h } = sizeRef.current;
    if (!box || w <= 0 || h <= 0) return;
    const pad = FIT_PADDING + inset / 2;
    const zoom = Math.min(
      FIT_MAX_ZOOM,
      Math.max(0.05, (w - pad * 2) / Math.max(1, box.x[1] - box.x[0])),
      Math.max(0.05, (h - pad * 2) / Math.max(1, box.y[1] - box.y[0])),
    );
    engine.centerAt(
      (box.x[0] + box.x[1]) / 2 + inset / 2 / zoom,
      (box.y[0] + box.y[1]) / 2,
      durationMs,
    );
    engine.zoom(zoom, durationMs);
  }, []);

  /**
   * Restart the layout.
   *
   * `d3ReheatSimulation` only sets `alpha` back to 1 and un-pauses the engine
   * — the ticks themselves happen in the render loop, one per frame, and under
   * reduced motion `cooldownTicks`/`cooldownTime` are 0, so the engine stops
   * again on the very next frame having ticked nothing. Reheat was a button
   * that did nothing at all for exactly the users who cannot see a layout
   * settle and most need it re-run.
   *
   * The warmup ticks are the settle those users get, and they run
   * SYNCHRONOUSLY whenever force-graph re-runs its update — which a new
   * `graphData` identity is what causes. So: reset alpha, then re-identify the
   * data. Same restart, arrived at without motion.
   */
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const reheat = useCallback(() => {
    engineRef.current?.d3ReheatSimulation();
    if (reducedMotion) setLayoutEpoch((epoch) => epoch + 1);
  }, [reducedMotion]);

  // A new layout is a new arrangement: settle it, then frame what it drew.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    reheat();
    const timer = setTimeout(() => fit(reducedMotion ? 0 : 400), reducedMotion ? 0 : 900);
    return () => clearTimeout(timer);
  }, [layout, reheat, fit, reducedMotion]);

  /**
   * Memoised, and that is load-bearing twice over.
   *
   * An inline `{ nodes, links }` is a new object on every render, and
   * react-kapsule forwards a prop whose identity changed — so a hover, a
   * search keystroke or a selection re-ran force-graph's whole update: the
   * warmup ticks again (all of them, synchronously, under reduced motion) and
   * `resetCountdown`, which restarts the cooldown clock. A graph the user was
   * hovering therefore never reached its settle. Handing the same object back
   * until the model or the layout epoch actually changes is what makes the
   * update mean "the graph changed".
   */
  const graphData = useMemo(
    () => ({ nodes: model.nodes, links: model.links }),
    [model.nodes, model.links, layoutEpoch],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      zoomToFit: (durationMs = 400) => fit(reducedMotion ? 0 : durationMs),
      centerOn: (nodeId, durationMs = 400) => {
        const node = model.nodes.find((candidate) => candidate.id === nodeId);
        if (!node || typeof node.x !== "number" || typeof node.y !== "number") return;
        // Offset by half the covered strip, so the node lands in the middle of
        // what is visible rather than the middle of the canvas. Centring a node
        // underneath the panel that describes it is the failure this exists to
        // prevent — and it is the agent's own `graph_select_node` that would
        // most often cause it.
        const zoom = engineRef.current?.zoom() || 1;
        engineRef.current?.centerAt(
          node.x + insetRight / 2 / zoom,
          node.y,
          reducedMotion ? 0 : durationMs,
        );
      },
      reveal: (nodeId, durationMs = 400) => {
        const engine = engineRef.current;
        const node = model.nodes.find((candidate) => candidate.id === nodeId);
        if (!engine || !node || typeof node.x !== "number" || typeof node.y !== "number") return;
        const screen = engine.graph2ScreenCoords(node.x, node.y);
        const right = width - insetRight - REVEAL_MARGIN;
        const bottom = height - REVEAL_MARGIN;
        // Signed distance out of the comfortable box, zero when inside it.
        const dx = Math.max(0, screen.x - right) + Math.min(0, screen.x - REVEAL_MARGIN);
        const dy = Math.max(0, screen.y - bottom) + Math.min(0, screen.y - REVEAL_MARGIN);
        if (dx === 0 && dy === 0) return;
        const zoom = engine.zoom() || 1;
        const centre = engine.centerAt();
        engine.centerAt(centre.x + dx / zoom, centre.y + dy / zoom, reducedMotion ? 0 : durationMs);
      },
      reheat,
      cancelAutoFit: () => {
        autoFitCancelledRef.current = true;
      },
    }),
    [model.nodes, reducedMotion, insetRight, width, height, reheat],
  );

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

  const isLinkHidden = useCallback(
    (link: EngineLink) => {
      const source = link.source as EngineNode | string | undefined;
      const target = link.target as EngineNode | string | undefined;
      // force-graph replaces the endpoint ids with the node objects once the
      // graph is loaded, and hands back the raw id before that.
      return (
        (typeof source === "object" && source !== null && isHidden(source)) ||
        (typeof target === "object" && target !== null && isHidden(target))
      );
    },
    [isHidden],
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

  /**
   * Captions that can be drawn without overprinting each other.
   *
   * Recomputed from SCREEN positions, so it has to run after the engine has
   * placed the nodes and again whenever the view moves. `onRenderFramePre`
   * would be the natural home — reset per frame, no staleness — but callbacks
   * on this wrapper are not to be trusted (`onEngineTick` and `onEngineStop`
   * never fire), so this is driven from React and the frame hook is only used
   * as a signal that the view changed.
   */
  const measure = useMemo(() => createCaptionMeasurer(), []);
  // Relationship types are painted at 9px, not 11px — a different font, so a
  // different cache.
  const measureEdge = useMemo(
    () => createCaptionMeasurer("9px ui-sans-serif, system-ui, sans-serif"),
    [],
  );
  const [captioned, setCaptioned] = useState<Set<string>>(() => new Set());
  const captionInputsRef = useRef({ selectedId: "", hoveredId: "", matchedIds: new Set<string>() });

  const recomputeCaptions = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || width === 0 || height === 0) return;
    const zoom = engine.zoom() || 1;
    const { selectedId, hoveredId: hovered, matchedIds: matches } = captionInputsRef.current;

    const screens = new Map<string, { x: number; y: number; radius: number }>();
    const obstacles: { id: string; rect: ReturnType<typeof nodeRect> }[] = [];
    const candidates: LabelCandidate[] = [];

    for (const node of model.nodes) {
      if (typeof node.x !== "number" || typeof node.y !== "number") continue;
      if (isHidden(node)) continue;
      const style = styleMap.styleForNode(node);
      const screen = engine.graph2ScreenCoords(node.x, node.y);
      const id = String(node.id);
      const radius = style.radius * zoom;
      screens.set(id, { x: screen.x, y: screen.y, radius });
      obstacles.push({ id, rect: nodeRect(screen.x, screen.y, radius) });
      if (!style.caption) continue;
      candidates.push({
        id,
        rect: captionRect(screen.x, screen.y, radius, measure(truncateCaption(style.caption))),
        tier:
          id === selectedId || id === hovered
            ? LabelTier.Pinned
            : matches.has(id)
              ? LabelTier.Match
              : LabelTier.Caption,
        weight: style.radius,
        exempt: [id],
      });
    }

    // Relationship types compete in the same pass, one tier down. They overlap
    // captions as readily as captions overlap each other, and a `DIRECTED` you
    // cannot read is a smaller loss than a `Metropolis` you cannot read.
    for (const link of model.links) {
      // What is painted is what is measured: the caption when there is one.
      const text = (link as EngineLink).caption || (link as EngineLink).type;
      if (!text) continue;
      const source = screens.get(String((link.source as EngineNode)?.id ?? link.source));
      const target = screens.get(String((link.target as EngineNode)?.id ?? link.target));
      if (!source || !target) continue;
      const sourceId = String((link.source as EngineNode)?.id ?? link.source);
      const targetId = String((link.target as EngineNode)?.id ?? link.target);
      candidates.push({
        id: `${EDGE_LABEL_PREFIX}${(link as EngineLink).id}`,
        rect: edgeLabelRect(source.x, source.y, target.x, target.y, measureEdge(text)),
        tier: LabelTier.Edge,
        weight: 0,
        exempt: [sourceId, targetId],
      });
    }

    const next = placeLabels(candidates, { obstacles, viewport: { width, height } });
    // Replace only on a real change: this runs on every frame the view moves,
    // and a new Set each time would re-render the whole canvas for nothing.
    setCaptioned((prev) => (sameIds(prev, next) ? prev : next));
  }, [model.nodes, model.links, styleMap, isHidden, measure, measureEdge, width, height]);

  const lastPlacedRef = useRef(0);
  const handleFramePre = useCallback(() => {
    const now = Date.now();
    if (now - lastPlacedRef.current < CAPTION_INTERVAL_MS) return;
    lastPlacedRef.current = now;
    recomputeCaptions();
  }, [recomputeCaptions]);

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
  // `styleMap` is rebuilt whenever the THEME changes, because it carries the
  // resolved canvas colours — and the fit loop below must not restart for a
  // colour. A user who switched to dark mode after arranging the graph lost
  // their view and could not get it back for the ~6.6s the loop runs. Read
  // through a ref so only the layout inputs are dependencies.
  const radiusRef = useRef((node: EngineNode) => styleMap.styleForNode(node).radius);
  radiusRef.current = (node: EngineNode) => styleMap.styleForNode(node).radius;

  useEffect(() => {
    if (width === 0 || height === 0) return;
    // Each genuine graph/viewport change gets one settling pass. Pointer or
    // wheel input cancels it through the handle: once the user takes control,
    // an automatic zoom-to-fit must never overwrite their camera.
    autoFitCancelledRef.current = false;
    tuneForces(engineRef.current, model.nodes.length, (node) => radiusRef.current(node));

    const deadline = Date.now() + cooldownFor(model.nodes.length) + FIT_TAIL_MS;
    // Fit immediately so nothing is off-screen even for one frame.
    fit();
    const timer = setInterval(() => {
      if (autoFitCancelledRef.current || Date.now() > deadline) {
        clearInterval(timer);
        return;
      }
      fit();
    }, FIT_INTERVAL_MS);
    return () => clearInterval(timer);
    // `fit` reads the drawer's width through a ref rather than taking it as a
    // dependency: opening the drawer must not restart the fit loop, or the
    // click that means "tell me about this node" would re-frame the graph the
    // user had arranged. `reveal` is what handles the drawer opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, width, height, fit]);

  // Selection, hover and search decide a caption's priority, so a change to
  // any of them re-places. Held in a ref as well so the framing interval and
  // the zoom handler can read them without being rebuilt on every hover.
  useEffect(() => {
    captionInputsRef.current = {
      selectedId: selection.node ? String(selection.node.id) : "",
      hoveredId: hoveredId ?? "",
      matchedIds,
    };
    recomputeCaptions();
  }, [selection.node, hoveredId, matchedIds, recomputeCaptions]);

  // A search is active when it can MATCH something, which is the trimmed term.
  // `matchNodes` trims and returns nothing for whitespace, so testing the raw
  // length instead dimmed every node as a non-match: typing a space into the
  // toolbar, or `graph_search(" ")`, greyed the entire graph out.
  const searching = query.trim().length > 0;

  const nodeCanvasObject = useCallback(
    (node: PositionedNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as EngineNode;
      const isSelected = selection.node?.id === graphNode.id;
      const isHovered = hoveredId === graphNode.id;
      const isMatch = searching && matchedIds.has(graphNode.id);
      paintNode(
        node,
        {
          style: styleMap.styleForNode(graphNode),
          selected: isSelected,
          hovered: isHovered,
          // A search dims the misses so the hits stand out; with no search
          // running, nothing is dimmed.
          dimmed: searching && !isMatch,
          pinned: pinnedIds.has(graphNode.id),
          // Placement decides, and it already knows about selection, hover
          // and search — see `recomputeCaptions`. Re-adding "always show the
          // selected node" here would put back the overlaps.
          showCaption: captioned.has(graphNode.id),
        },
        theme,
        ctx,
        globalScale,
      );
    },
    [styleMap, selection.node?.id, hoveredId, searching, matchedIds, pinnedIds, theme, captioned],
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
      if (!captioned.has(`${EDGE_LABEL_PREFIX}${(link as EngineLink).id}`)) return;
      paintEdgeLabel(
        link,
        edgeCaption(link as EngineLink),
        theme,
        ctx,
        globalScale,
        (link as EngineLink).emphasis,
      );
    },
    [model.links.length, theme, captioned],
  );

  /**
   * Freezing is a fact about the ENGINE, not about a React Set.
   *
   * The Freeze button and the right-click action only ever added an id to
   * `pinnedIds`; the simulation never heard about it, so a node the UI marked
   * frozen carried on drifting. The inverse was broken too: `onNodeDragEnd`
   * writes `fx`/`fy` directly, so "Unpin all" cleared the set and left every
   * dragged node nailed in place with no marker to say why.
   *
   * One reconciliation, both directions. Mutating the node objects is the
   * interface force-graph offers — they are the same objects the simulation
   * holds — so the reheat is what makes the change visible.
   */
  useEffect(() => {
    let changed = false;
    for (const node of model.nodes) {
      const shouldPin = pinnedIds.has(node.id);
      const isPinned = node.fx != null || node.fy != null;
      if (shouldPin === isPinned) continue;
      if (shouldPin) {
        node.fx = node.x;
        node.fy = node.y;
      } else {
        node.fx = undefined;
        node.fy = undefined;
      }
      changed = true;
    }
    if (changed) reheat();
  }, [pinnedIds, model.nodes, reheat]);

  return (
    <ForceGraph2D<EngineNode, EngineLink>
      ref={engineRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="transparent"
      // The bound on zooming by hand; framing has its own, lower one (`fit`).
      maxZoom={MAX_ZOOM}
      dagMode={DAG_MODE[layout]}
      dagLevelDistance={90}
      // A cycle cannot be drawn as a hierarchy. The engine's default is to
      // THROW; falling back to the force layout, and saying so, is the host's.
      onDagError={() => onLayoutUnavailable?.()}
      nodeRelSize={4}
      nodeVal={(node) => (styleMap.styleForNode(node as EngineNode).radius / 4) ** 2}
      nodeVisibility={(node) => !isHidden(node)}
      // Hiding a label has to hide its relationships too. `nodeVisibility`
      // alone leaves the links drawn, so filtering a type out of the legend
      // left arrows pointing at nothing — which reads as missing nodes rather
      // than as a filter doing its job.
      linkVisibility={(link) => !isLinkHidden(link)}
      // MUST return an element, never a string: force-graph's tooltip assigns
      // a string via innerHTML, which would execute markup stored in the graph.
      nodeLabel={((node: EngineNode) => nodeTooltip(node, styleMap)) as never}
      linkLabel={((link: EngineLink) => edgeTooltip(link as unknown as GraphEdge)) as never}
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkCanvasObjectMode={() => "after"}
      linkCanvasObject={linkCanvasObject}
      // What the graph is ABOUT reads first: a `strong` edge is drawn in the
      // accent, thicker and with a larger arrow; structure (`muted`) recedes.
      // border is too faint to follow across a canvas; mutedForeground reads
      // as a line without competing with the nodes.
      linkColor={(link) => (link.emphasis === "strong" ? theme.ring : theme.mutedForeground)}
      linkWidth={(link) => EDGE_WIDTH[link.emphasis ?? "normal"]}
      linkDirectionalArrowLength={(link) => EDGE_ARROW[link.emphasis ?? "normal"]}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(link) =>
        link.emphasis === "strong" ? theme.ring : theme.mutedForeground
      }
      d3VelocityDecay={0.32}
      // Every way a label can move — the layout settling, a pan, a zoom, or the
      // user dragging one node — shows up as a rendered frame, and nothing else
      // reports all four. `onRenderFramePre` DOES fire through this wrapper,
      // unlike `onEngineTick`/`onEngineStop`; verified in a browser.
      onRenderFramePre={handleFramePre}
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
      // Reduced motion means "do not ANIMATE the settle", not "do not settle".
      // `cooldownTime: 0` alone stopped the simulation before it had arranged
      // anything, so these users got the engine's initial placement — a
      // scatter with edges crossing at random, which is not a graph. The ticks
      // run synchronously before the first paint instead: the same layout,
      // arrived at without motion. Bounded, because they block.
      warmupTicks={reducedMotion ? warmupFor(model.nodes.length) : 0}
      cooldownTicks={reducedMotion ? 0 : undefined}
      cooldownTime={reducedMotion ? 0 : cooldownFor(model.nodes.length)}
    />
  );
}

export default GraphCanvas;
