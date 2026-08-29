import { describeEdge, describeNode, type GraphStyleMap } from "./use-graph-styling.ts";
import type { GraphEdge, GraphNode } from "./model.ts";

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
function tooltipElement(heading: string, rows: [string, string][]): HTMLElement {
  const root = document.createElement("div");
  root.style.maxWidth = "20rem";

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.textContent = heading;
  root.appendChild(title);

  for (const [key, value] of rows) {
    const row = document.createElement("div");
    row.style.opacity = "0.8";
    row.textContent = `${key}: ${value}`;
    root.appendChild(row);
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
      text.length > MAX_TOOLTIP_VALUE_CHARS ? `${text.slice(0, MAX_TOOLTIP_VALUE_CHARS - 1)}…` : text,
    ]);
  }
  return rows;
}

export function nodeTooltip(node: GraphNode, styleMap: GraphStyleMap): HTMLElement {
  return tooltipElement(
    describeNode(node, styleMap.styleForNode(node).caption),
    previewRows(node.properties),
  );
}

export function edgeTooltip(edge: GraphEdge): HTMLElement {
  return tooltipElement(describeEdge(edge), previewRows(edge.properties));
}
