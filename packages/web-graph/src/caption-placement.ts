/**
 * Which labels can be drawn without overprinting anything.
 *
 * Choosing labels by rank alone — the biggest N nodes, or "everything above
 * some zoom" — is position-blind, and in a force layout the important nodes are
 * exactly the ones that end up near each other. Two adjacent hubs both qualify,
 * their captions overlap, and no amount of force tuning fixes it: it is a label
 * placement problem, not a layout problem.
 *
 * So: walk the candidates in priority order and keep the ones whose rectangle
 * is still free. Density then takes care of itself — zoomed in, few things
 * share the viewport and nearly everything is labelled; zoomed out, collisions
 * thin the labels down to the structure.
 *
 * Node captions and relationship types go through the SAME pass, competing for
 * the same space, because they overlap each other as readily as they overlap
 * their own kind. Captions outrank relationship types: a node's name is what
 * you navigate by, and a `DIRECTED` you cannot read is a smaller loss than a
 * `Metropolis` you cannot read.
 *
 * Pure, and works entirely in SCREEN pixels, so it needs neither the canvas nor
 * the engine and can be tested without either.
 */

/** Priority order. Lower is placed first and therefore wins its space. */
export const LabelTier = {
  /**
   * Always drawn, and reserves its space before anything else. Only for what
   * the user has selected or is pointing at — that label is the answer to a
   * question they just asked, and it must not lose to a bigger neighbour.
   */
  Pinned: 0,
  /** A search hit. Ahead of ordinary captions, but still yields to a collision. */
  Match: 1,
  /** An ordinary node caption, ranked among its peers by weight. */
  Caption: 2,
  /** A relationship type. Drawn only with space left over. */
  Edge: 3,
} as const;

export type LabelTierValue = (typeof LabelTier)[keyof typeof LabelTier];

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LabelCandidate {
  id: string;
  /** The space the label will occupy, in screen pixels. */
  rect: Rect;
  tier: LabelTierValue;
  /** Ranking within a tier; larger wins. Node radius, which follows degree. */
  weight: number;
  /**
   * Obstacles this label may overlap — its own node's disc, or the two ends of
   * its own edge. Without it a caption would collide with the very node it
   * names.
   */
  exempt?: readonly string[];
}

export interface PlacementOptions {
  /**
   * Obstacles nothing may print over: the node discs. Keyed so a label can
   * exempt its own.
   */
  obstacles?: readonly { id: string; rect: Rect }[];
  /**
   * Where the labels have to fit. Candidates outside it are dropped — an
   * off-screen label reserving space would suppress a visible one for no one's
   * benefit. Omit to place without regard to the viewport.
   */
  viewport?: { width: number; height: number };
  /**
   * Stop after considering this many candidates.
   *
   * The scan is quadratic in what it places, which is fine for the tens of
   * labels that fit on a screen and not fine for a 5,000-node graph where
   * almost every candidate would be rejected anyway.
   */
  limit?: number;
  /** How far outside the viewport a label may sit and still be considered. */
  margin?: number;
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const centreX = (rect: Rect) => (rect.left + rect.right) / 2;
const centreY = (rect: Rect) => (rect.top + rect.bottom) / 2;

/**
 * Order is the whole algorithm, so it must be total.
 *
 * Ties broken by id, deliberately: two nodes of equal degree competing for the
 * same space would otherwise swap between frames, and a label that flickers
 * between two names is worse than either name alone.
 */
function byPriority(a: LabelCandidate, b: LabelCandidate): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.weight !== b.weight) return b.weight - a.weight;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function placeLabels(
  candidates: readonly LabelCandidate[],
  options: PlacementOptions = {},
): Set<string> {
  const { obstacles = [], viewport, limit = 160, margin = 80 } = options;

  const visible = viewport
    ? candidates.filter((candidate) => {
        const x = centreX(candidate.rect);
        const y = centreY(candidate.rect);
        return (
          x >= -margin &&
          x <= viewport.width + margin &&
          y >= -margin &&
          y <= viewport.height + margin
        );
      })
    : candidates.slice();

  const ordered = visible.sort(byPriority).slice(0, limit);

  const placed = new Set<string>();
  const taken: { id?: string; rect: Rect }[] = obstacles.map((obstacle) => ({
    id: obstacle.id,
    rect: obstacle.rect,
  }));

  for (const candidate of ordered) {
    const blocked = taken.some(
      (other) =>
        !(other.id !== undefined && candidate.exempt?.includes(other.id)) &&
        overlaps(candidate.rect, other.rect),
    );
    // A pinned label is not negotiable: it is drawn, and it takes its space out
    // of the running for everything after it.
    if (candidate.tier !== LabelTier.Pinned && blocked) continue;
    taken.push({ rect: candidate.rect });
    placed.add(candidate.id);
  }

  return placed;
}

/** The disc a node occupies — an obstacle no label may print across. */
export function nodeRect(x: number, y: number, radius: number): Rect {
  return { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius };
}

/** Where a node's caption sits: centred under the node. Matches `paintNode`. */
export function captionRect(
  x: number,
  y: number,
  radius: number,
  width: number,
  { lineHeight = 14, gap = 3, padX = 3 } = {},
): Rect {
  const half = width / 2 + padX;
  const top = y + radius + gap;
  return { left: x - half, right: x + half, top, bottom: top + lineHeight };
}

/**
 * Where a relationship type sits: at the midpoint of the edge, rotated to
 * follow it.
 *
 * Approximated by the axis-aligned box the rotated text fits inside. That is
 * generous for a diagonal edge, which is the right way to be wrong — it drops a
 * label that would have just fitted rather than printing one that just does
 * not.
 */
export function edgeLabelRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  { lineHeight = 12 } = {},
): Rect {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const halfW = (width * cos + lineHeight * sin) / 2;
  const halfH = (width * sin + lineHeight * cos) / 2;
  return { left: midX - halfW, right: midX + halfW, top: midY - halfH, bottom: midY + halfH };
}

/**
 * Label widths, measured once per string.
 *
 * `paintNode` sets the font in GRAPH units (`11 / globalScale`), which is a
 * constant 11 pixels on screen at every zoom — so a label's rendered width
 * never changes and measuring it per frame would be pure waste. Keyed by the
 * string that will actually be drawn (already truncated), so two nodes with the
 * same name measure once.
 */
export function createCaptionMeasurer(font = "11px ui-sans-serif, system-ui, sans-serif") {
  const widths = new Map<string, number>();
  let ctx: CanvasRenderingContext2D | null | undefined;

  return (text: string): number => {
    const cached = widths.get(text);
    if (cached !== undefined) return cached;

    if (ctx === undefined) {
      // Detached: this measures text, it never draws. `getContext` returns null
      // in a jsdom without a canvas implementation, which is why the estimate
      // below exists rather than a crash.
      ctx =
        typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
      if (ctx) ctx.font = font;
    }

    // Only ever used where there is no canvas to ask, and a placement that is
    // slightly wrong beats no labels at all.
    const width = ctx ? ctx.measureText(text).width : text.length * 6;
    widths.set(text, width);
    return width;
  };
}
