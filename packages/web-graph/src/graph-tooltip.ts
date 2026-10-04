import { describeEdge, describeNode, type GraphStyleMap } from "./use-graph-styling.ts";
import {
  edgeCaption,
  primaryLabel,
  type GraphDetail,
  type GraphEdge,
  type GraphNode,
} from "./model.ts";

/**
 * Build the hover tooltip as a DOM element, NOT as an HTML string.
 *
 * `force-graph`'s tooltip (`float-tooltip`) does `selection.html(content)` when
 * given a string — i.e. `innerHTML`. Node captions and property values come
 * straight out of the database, so a string tooltip would execute markup stored
 * in the graph. Returning an `HTMLElement` takes the library's other branch,
 * which appends the node as-is, and everything here is set via `textContent`.
 *
 * Do not "simplify" this back into a template literal.
 */
function tooltipElement(
  heading: string,
  rows: [string, string][],
  kind?: string,
  hint?: string,
): HTMLElement {
  // Classes, never inline colours: every colour is a theme token, set in
  // styles.css (`.foundry-graph-tip__*`).
  const root = document.createElement("div");

  if (kind) {
    const label = document.createElement("div");
    label.className = "foundry-graph-tip__kind";
    label.textContent = kind;
    root.appendChild(label);
  }

  const title = document.createElement("div");
  title.className = "foundry-graph-tip__title";
  title.textContent = heading;
  root.appendChild(title);

  if (rows.length) {
    const grid = document.createElement("div");
    grid.className = "foundry-graph-tip__rows";
    for (const [key, value] of rows) {
      const k = document.createElement("div");
      k.className = "foundry-graph-tip__key";
      k.textContent = key;
      const v = document.createElement("div");
      v.className = "foundry-graph-tip__value";
      v.textContent = value;
      grid.append(k, v);
    }
    root.appendChild(grid);
  }

  if (hint) {
    const line = document.createElement("div");
    line.className = "foundry-graph-tip__hint";
    line.textContent = hint;
    root.appendChild(line);
  }
  return root;
}

/** Property rows to preview in a tooltip — enough to identify, not a dump. */
const MAX_TOOLTIP_ROWS = 4;
const MAX_TOOLTIP_VALUE_CHARS = 80;

function previewRows(properties: Record<string, unknown> | undefined): [string, string][] {
  const rows: [string, string][] = [];
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (rows.length >= MAX_TOOLTIP_ROWS) break;
    if (value === null || value === undefined) continue;
    const text = String(value);
    rows.push([
      key,
      text.length > MAX_TOOLTIP_VALUE_CHARS
        ? `${text.slice(0, MAX_TOOLTIP_VALUE_CHARS - 1)}…`
        : text,
    ]);
  }
  return rows;
}

/**
 * A curated hover: the first few details, never a link or the raw properties.
 *
 * The card follows the cursor, so nothing in it can be clicked: a link row
 * would show "Open at the passage" that no pointer can ever reach. Links live
 * in the details drawer a click opens, and the hint says so.
 */
function detailRows(details: GraphDetail[]): [string, string][] {
  return details
    .filter((detail) => !detail.href)
    .slice(0, MAX_TOOLTIP_ROWS)
    .map(({ label, value }) => [
      label,
      value.length > MAX_TOOLTIP_VALUE_CHARS
        ? `${value.slice(0, MAX_TOOLTIP_VALUE_CHARS - 1)}…`
        : value,
    ]);
}

function clickHint(details: GraphDetail[]): string {
  return details.some((detail) => detail.href)
    ? "Click for details and links"
    : "Click for details";
}

export function nodeTooltip(node: GraphNode, styleMap: GraphStyleMap): HTMLElement {
  const caption = styleMap.styleForNode(node).caption;
  if (node.details?.length) {
    const kind = styleMap.nameForLabel?.(primaryLabel(node)) ?? primaryLabel(node);
    return tooltipElement(caption, detailRows(node.details), kind, clickHint(node.details));
  }
  return tooltipElement(
    describeNode(node, caption, styleMap.nameForLabel),
    previewRows(node.properties),
  );
}

export function edgeTooltip(edge: GraphEdge): HTMLElement {
  if (edge.details?.length) {
    return tooltipElement(
      edgeCaption(edge),
      detailRows(edge.details),
      undefined,
      clickHint(edge.details),
    );
  }
  return tooltipElement(describeEdge(edge), previewRows(edge.properties));
}
