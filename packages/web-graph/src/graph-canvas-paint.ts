/**
 * Canvas painting for {@link GraphView}.
 *
 * Pure functions over a 2D context, deliberately separate from the React
 * component: painting is the part that is easy to get wrong at odd zoom levels
 * and impossible to inspect from a test that only renders JSX.
 *
 * Everything here works in GRAPH coordinates — force-graph has already applied
 * the pan/zoom transform. `globalScale` is the current zoom, needed to keep
 * text and stroke widths a constant size on screen rather than growing with
 * the graph.
 */

import type { NodeStyle } from "./use-graph-styling.ts";
import type { GraphTheme } from "./theme.ts";

/** A node after force-graph has assigned it a position. */
export interface PositionedNode {
  id?: string | number;
  x?: number;
  y?: number;
}

export interface NodePaintState {
  style: NodeStyle;
  /** Draw the selection ring. */
  selected: boolean;
  /** Draw the hover ring. */
  hovered: boolean;
  /**
   * Dim the node: a search is active and this node is not a match. Applied via
   * `globalAlpha` rather than by rewriting the colour string, so it works for
   * any colour format the host's tokens happen to use (oklch, hsl, hex).
   */
  dimmed: boolean;
  /** The user pinned this node — draw the pin marker. */
  pinned: boolean;
  /**
   * Draw the caption.
   *
   * Decided per node rather than by one global zoom threshold. A single
   * threshold forces a choice between two bad outcomes: label everything and
   * watch dense neighbourhoods turn into overlapping scratch, or label nothing
   * and show an anonymous constellation. Budgeting keeps the graph readable at
   * every zoom — the nodes that carry the structure stay named, the rest
   * appear as you zoom in.
   */
  showCaption: boolean;
}

/**
 * Which nodes keep their caption when zoomed out.
 *
 * Ranked by radius, which is already a function of degree — so the budget
 * spends itself on the hubs, the nodes someone is actually orienting by.
 */
export function captionBudget(
  nodes: readonly { id?: string | number }[],
  radiusOf: (node: { id?: string | number }) => number,
  limit = 14,
): Set<string> {
  if (nodes.length <= limit) return new Set(nodes.map((node) => String(node.id)));
  return new Set(
    [...nodes]
      .sort((a, b) => radiusOf(b) - radiusOf(a))
      .slice(0, limit)
      .map((node) => String(node.id)),
  );
}

/**
 * At or above this zoom there is room for every caption, so draw them all.
 * Below it, only the nodes in the caption budget get one (see
 * `captionBudget`), plus whatever the user is pointing at or searching for.
 */
export const FULL_CAPTION_SCALE = 0.75;
const MAX_CAPTION_CHARS = 22;

export function truncateCaption(text: string, max = MAX_CAPTION_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Paint one node: filled disc, contrast ring, optional selection/hover ring,
 * pin marker, and the caption underneath.
 */
export function paintNode(
  node: PositionedNode,
  state: NodePaintState,
  theme: GraphTheme,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
): void {
  const { x, y } = node;
  if (typeof x !== "number" || typeof y !== "number") return;
  const { style, selected, hovered, dimmed, pinned, showCaption } = state;
  const r = style.radius;

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.15;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = style.color;
  ctx.fill();

  // A hairline in the background colour separates overlapping nodes of the
  // same label, which otherwise merge into one blob at low zoom.
  ctx.lineWidth = 0.6 / globalScale;
  ctx.strokeStyle = theme.background;
  ctx.stroke();

  if (selected || hovered) {
    ctx.beginPath();
    ctx.arc(x, y, r + (selected ? 3 : 2), 0, 2 * Math.PI);
    ctx.lineWidth = (selected ? 2 : 1.5) / globalScale;
    ctx.strokeStyle = selected ? theme.ring : theme.mutedForeground;
    ctx.stroke();
  }

  if (pinned) {
    ctx.beginPath();
    ctx.arc(x + r * 0.78, y - r * 0.78, Math.max(1.2, r * 0.28), 0, 2 * Math.PI);
    ctx.fillStyle = theme.foreground;
    ctx.fill();
  }

  if (showCaption && style.caption) {
    // Constant size on screen: dividing by the zoom keeps the label legible
    // when zoomed out and stops it ballooning when zoomed in.
    const fontSize = 11 / globalScale;
    const text = truncateCaption(style.caption);
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Knock out a pill behind the text. Captions in a force layout overlap
    // each other and the edges constantly; without a backing plate the
    // overlaps turn into unreadable pencil-scratch, and no amount of layout
    // tuning prevents it in a dense neighbourhood.
    const padX = 3 / globalScale;
    const padY = 1.5 / globalScale;
    const width = ctx.measureText(text).width;
    const top = y + r + 3 / globalScale;
    ctx.globalAlpha *= 0.82;
    ctx.fillStyle = theme.background;
    ctx.fillRect(x - width / 2 - padX, top - padY, width + padX * 2, fontSize + padY * 2);
    ctx.globalAlpha = dimmed ? 0.15 : 1;

    ctx.fillStyle = selected || hovered ? theme.foreground : theme.mutedForeground;
    ctx.fillText(text, x, top);
  }

  ctx.restore();
}

/**
 * Paint the hit-test mask for a node.
 *
 * force-graph renders this to an off-screen colour-indexed buffer to decide
 * what the pointer is over. It must cover the same area the visible node does,
 * or the node's clickable region drifts away from the circle the user sees.
 */
export function paintNodePointerArea(
  node: PositionedNode,
  color: string,
  style: NodeStyle,
  ctx: CanvasRenderingContext2D,
): void {
  const { x, y } = node;
  if (typeof x !== "number" || typeof y !== "number") return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, style.radius + 3, 0, 2 * Math.PI);
  ctx.fill();
}

export interface PositionedLink {
  source?: PositionedNode | string | number;
  target?: PositionedNode | string | number;
}

const asPositioned = (end: PositionedLink["source"]): PositionedNode | null =>
  typeof end === "object" && end !== null ? end : null;

/** Below this zoom, relationship labels collide into noise. */
export const EDGE_LABEL_MIN_SCALE = 1.4;

/**
 * Draw the relationship type at the midpoint of an edge.
 *
 * Runs in force-graph's `"after"` link mode, so the default line and arrow are
 * already painted; this only adds the label. Text is rotated to follow the
 * edge and flipped when the edge points leftwards, so labels never read
 * upside-down.
 */
export function paintEdgeLabel(
  link: PositionedLink,
  label: string,
  theme: GraphTheme,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
): void {
  if (globalScale < EDGE_LABEL_MIN_SCALE || !label) return;
  const source = asPositioned(link.source);
  const target = asPositioned(link.target);
  if (!source || !target) return;
  const { x: x1, y: y1 } = source;
  const { x: x2, y: y2 } = target;
  if (
    typeof x1 !== "number" ||
    typeof y1 !== "number" ||
    typeof x2 !== "number" ||
    typeof y2 !== "number"
  ) {
    return;
  }

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  let angle = Math.atan2(y2 - y1, x2 - x1);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

  const fontSize = Math.max(7, 9 / globalScale);
  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  // Knock out the line behind the text — an unbacked label on top of its own
  // edge is unreadable.
  const width = ctx.measureText(label).width;
  ctx.fillStyle = theme.background;
  ctx.fillRect(-width / 2 - 1 / globalScale, -fontSize, width + 2 / globalScale, fontSize + 1);

  ctx.fillStyle = theme.mutedForeground;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}
