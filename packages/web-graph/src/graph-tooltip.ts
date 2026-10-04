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
/** Full class strings, written out so Tailwind's scan finds every one. */
const TIP = {
  kind: "text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
  title: "font-semibold text-popover-foreground [overflow-wrap:anywhere]",
  rows: "mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 border-t border-border pt-1.5",
  // A producer's long label wraps inside the card instead of widening it.
  key: "max-w-32 text-muted-foreground [overflow-wrap:anywhere]",
  value: "line-clamp-2 text-popover-foreground [overflow-wrap:anywhere]",
  hint: "mt-1.5 text-[11px] text-muted-foreground",
} as const;

function tooltipElement(
  heading: string,
  rows: [string, string][],
  kind?: string,
  hint?: string,
): HTMLElement {
  // Tailwind utilities on theme tokens, like the rest of GraphView: they need
  // no optional stylesheet, and never an inline colour. The `foundry-graph-tip__*`
  // names are hooks for tests and hosts. Only the container float-tooltip
  // draws around this card needs styles.css (`.float-tooltip-kap`).
  const root = document.createElement("div");

  if (kind) {
    const label = document.createElement("div");
    label.className = `foundry-graph-tip__kind ${TIP.kind}`;
    label.textContent = kind;
    root.appendChild(label);
  }

  const title = document.createElement("div");
  title.className = `foundry-graph-tip__title ${TIP.title}`;
  title.textContent = heading;
  root.appendChild(title);

  if (rows.length) {
    const grid = document.createElement("div");
    grid.className = `foundry-graph-tip__rows ${TIP.rows}`;
    for (const [key, value] of rows) {
      const k = document.createElement("div");
      k.className = `foundry-graph-tip__key ${TIP.key}`;
      k.textContent = key;
      const v = document.createElement("div");
      v.className = `foundry-graph-tip__value ${TIP.value}`;
      v.textContent = value;
      grid.append(k, v);
    }
    root.appendChild(grid);
  }

  if (hint) {
    const line = document.createElement("div");
    line.className = `foundry-graph-tip__hint ${TIP.hint}`;
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

export interface TooltipOptions {
  /** A click opens the details drawer; without one, no hint promises it. */
  clickShowsDetails?: boolean;
}

function clickHint(details: GraphDetail[], options: TooltipOptions): string | undefined {
  if (!options.clickShowsDetails) return undefined;
  return details.some((detail) => detail.href)
    ? "Click for details and links"
    : "Click for details";
}

export function nodeTooltip(
  node: GraphNode,
  styleMap: GraphStyleMap,
  options: TooltipOptions = {},
): HTMLElement {
  const caption = styleMap.styleForNode(node).caption;
  if (node.details?.length) {
    const kind = styleMap.nameForLabel?.(primaryLabel(node)) ?? primaryLabel(node);
    return tooltipElement(
      caption,
      detailRows(node.details),
      kind,
      clickHint(node.details, options),
    );
  }
  return tooltipElement(
    describeNode(node, caption, styleMap.nameForLabel),
    previewRows(node.properties),
  );
}

export function edgeTooltip(edge: GraphEdge, options: TooltipOptions = {}): HTMLElement {
  if (edge.details?.length) {
    return tooltipElement(
      edgeCaption(edge),
      detailRows(edge.details),
      undefined,
      clickHint(edge.details, options),
    );
  }
  return tooltipElement(describeEdge(edge), previewRows(edge.properties));
}
