import { useMemo } from "react";
import {
  hasOwn,
  primaryLabel,
  resolveCaption,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "./model.ts";
import type { GraphTheme } from "./theme.ts";

/** Host-supplied styling overrides, all optional. */
export interface GraphStyling {
  /** Explicit colour per label. Labels not listed fall back to the palette. */
  colors?: Record<string, string>;
  /** Property key to read the caption from, per label. */
  captionKeys?: Record<string, string>;
  /** Relative node size per label (1 = default). */
  sizes?: Record<string, number>;
}

/** Everything the canvas needs to draw one node, precomputed once per payload. */
export interface NodeStyle {
  color: string;
  caption: string;
  radius: number;
}

export interface GraphStyleMap {
  /** Distinct labels in first-seen order — also the legend's order. */
  labels: string[];
  colorForLabel: (label: string) => string;
  styleForNode: (node: GraphNode) => NodeStyle;
  /** Distinct relationship types, for the legend. */
  edgeTypes: string[];
}

/** Small, stable string hash (FNV-1a). Deterministic across runs and machines. */
function hashLabel(label: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i += 1) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Assign a palette slot per label — by hash, then linear probing.
 *
 * Colour has to mean the same thing across queries. Assigning slots in
 * first-seen order is collision-free but makes `Person` blue in one result and
 * red in the next, so the legend has to be re-read every time and no mental
 * model of the graph ever forms. Hashing pins a label to a colour it keeps.
 *
 * Probing covers the hash's weakness: two labels that hash to the same slot
 * would otherwise be indistinguishable in exactly the small graphs where the
 * legend matters most. With eight colours and a handful of labels a collision
 * is likelier than not, so dropping it is not an option.
 *
 * The cost, stated plainly because it is a real one: a label's colour depends
 * on which OTHER labels are present. Add a label that hashes to the same slot
 * and sorts earlier, and the first label moves one slot along — so a label can
 * change colour between two queries, and can change colour mid-session as a
 * merge grows the graph. There is no way to have both properties with a fixed
 * eight-colour palette; distinctness within one graph is the one worth having,
 * because the swatch is only ever read next to the label's own name.
 *
 * Sorted order at least makes the outcome depend on WHICH labels are present
 * and never on the order the producer happened to return them in.
 */
function buildLabelColors(
  labels: string[],
  palette: string[],
  overrides: Record<string, string> | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<number>();

  const assignable = [...labels].sort();
  for (const label of assignable) {
    // An own-key check because a label is untrusted: `overrides?.["toString"]`
    // finds a function on the prototype and paints a node with it.
    const override = overrides && hasOwn(overrides, label) ? overrides[label] : undefined;
    if (override) {
      out.set(label, override);
      continue;
    }
    let slot = hashLabel(label) % palette.length;
    // At most one full pass: with more labels than colours some reuse is
    // unavoidable, and stopping keeps this O(palette) rather than looping.
    for (let probe = 0; probe < palette.length && taken.has(slot); probe += 1) {
      slot = (slot + 1) % palette.length;
    }
    taken.add(slot);
    out.set(label, palette[slot]);
  }
  return out;
}

/** Radius of a leaf node, in graph units. */
const BASE_RADIUS = 6;
/** A hub may grow to this multiple of the base — enough to read at a glance,
 *  not so much that one supernode swallows the canvas. */
const MAX_DEGREE_SCALE = 2.4;

export function useGraphStyling(
  payload: GraphPayload,
  theme: GraphTheme,
  styling?: GraphStyling,
): GraphStyleMap {
  return useMemo(() => {
    const labels: string[] = [];
    const seenLabels = new Set<string>();
    for (const node of payload.nodes) {
      const label = primaryLabel(node);
      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        labels.push(label);
      }
    }

    const edgeTypes: string[] = [];
    const seenTypes = new Set<string>();
    for (const edge of payload.edges) {
      const type = edge.type ?? "RELATED";
      if (!seenTypes.has(type)) {
        seenTypes.add(type);
        edgeTypes.push(type);
      }
    }

    // Producer-supplied legend colours are an override of last resort — the
    // host's explicit `styling.colors` still wins.
    const producerColors: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const [label, hint] of Object.entries(payload.legend ?? {})) {
      if (hint.color) producerColors[label] = hint.color;
    }
    const colors = buildLabelColors(labels, theme.palette, {
      ...producerColors,
      ...(styling?.colors ?? {}),
    });

    // A `Map`, because the keys are LABELS and labels come from the payload.
    // A graph with a label called `constructor` or `toString` reads an
    // inherited function out of an object literal, and it would be handed to
    // `resolveCaption` as the caption key.
    const captionKeys = new Map<string, string>();
    for (const [label, hint] of Object.entries(payload.legend ?? {})) {
      if (hint.captionKey) captionKeys.set(label, hint.captionKey);
    }
    for (const [label, key] of Object.entries(styling?.captionKeys ?? {})) {
      captionKeys.set(label, key);
    }

    const colorForLabel = (label: string) =>
      colors.get(label) ?? theme.palette[0] ?? theme.foreground;

    // Size by connectedness. In a force layout every node is a same-sized
    // dot, so the structure — which nodes hold the graph together — is
    // invisible until you trace the edges by eye. Scaling by degree makes the
    // hubs read immediately, and it is the single change that most makes a
    // force graph look like a graph explorer rather than a hairball.
    // sqrt, not linear: degree is long-tailed, and a linear scale turns one
    // supernode into a disc that covers everything else.
    const degree = new Map<string, number>();
    for (const edge of payload.edges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    let maxDegree = 0;
    for (const value of degree.values()) maxDegree = Math.max(maxDegree, value);

    const degreeScale = (id: string): number => {
      if (maxDegree <= 1) return 1;
      const ratio = Math.sqrt((degree.get(id) ?? 0) / maxDegree);
      return 1 + ratio * (MAX_DEGREE_SCALE - 1);
    };

    const styleCache = new Map<string, NodeStyle>();
    const styleForNode = (node: GraphNode): NodeStyle => {
      const cached = styleCache.get(node.id);
      if (cached) return cached;
      const label = primaryLabel(node);
      const style: NodeStyle = {
        color: colorForLabel(label),
        caption: resolveCaption(node, captionKeys.get(label)),
        radius:
          BASE_RADIUS *
          degreeScale(node.id) *
          (styling?.sizes && hasOwn(styling.sizes, label) ? (styling.sizes[label] ?? 1) : 1),
      };
      styleCache.set(node.id, style);
      return style;
    };

    return { labels, colorForLabel, styleForNode, edgeTypes };
  }, [payload, theme, styling]);
}

/** Human-readable one-liner for a hover tooltip. */
export function describeNode(node: GraphNode, caption: string): string {
  const labels = node.labels?.length ? node.labels.join(":") : "Node";
  return `${labels} — ${caption}`;
}

export function describeEdge(edge: GraphEdge): string {
  return edge.type ?? "RELATED";
}
export { buildLabelColors as __buildLabelColorsForTest };
