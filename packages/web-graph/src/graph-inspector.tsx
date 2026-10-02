import { useEffect, useRef, type ReactNode } from "react";
import { Maximize2, Snowflake, X } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  edgeCaption,
  primaryLabel,
  resolveCaption,
  safeStringify,
  type GraphEdge,
  type GraphNode,
} from "./model.ts";
import type { GraphSelection } from "./use-graph-view-state.ts";

/** Render a property value without collapsing structure into "[object Object]". */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  // `safeStringify`, not `JSON.stringify`: a structured property containing a
  // `bigint` (`{ count: 10n }`) THROWS, and the fallback then renders
  // "[object Object]" — hiding the value in the one panel whose entire job is
  // showing it. Cycles are handled for the same reason.
  return safeStringify(value);
}

/**
 * Label/value rows, matching the field list a downstream app already uses for
 * "inspect this item".
 *
 * A fixed label column rather than a two-column grid: property names in a
 * graph are short and repetitive (`name`, `year`, `title`), values are not, so
 * an auto-sized label column jitters between selections and makes the drawer
 * feel like it is redrawing itself every time you click.
 */
function PropertyRows({ properties }: { properties: Record<string, unknown> | undefined }) {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-6 text-center text-sm">
        No properties.
      </p>
    );
  }
  return (
    <div className="divide-border/60 border-border/70 divide-y rounded-xl border">
      {entries.map(([key, value]) => (
        <div key={key} className="px-3 py-2">
          <div className="flex min-h-9 items-start gap-3">
            <span
              className="text-muted-foreground w-28 shrink-0 truncate pt-0.5 text-sm"
              title={key}
            >
              {key}
            </span>
            <div className="text-foreground min-w-0 flex-1 break-words text-sm">
              {formatValue(value)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The drawer's width in pixels, matching `w-80` below.
 *
 * Exported because the canvas has to know how much of itself is covered:
 * a node hidden behind the drawer is a node you selected and then could not
 * see. Kept as a number rather than measured, so the pan can be issued in
 * the same frame the drawer opens.
 */
export const GRAPH_INSPECTOR_WIDTH = 320;

export interface GraphInspectorProps {
  selection: GraphSelection;
  colorForLabel: (label: string) => string;
  /** The same caption the canvas draws — resolved once by the styling hook. */
  captionOf: (node: GraphNode) => string;
  onClose: () => void;
  /** Rendered as an "Expand" action when the host supplies one. */
  onExpandNode?: (node: GraphNode) => void;
  /** Freeze the node where it sits, so the layout stops moving it around. */
  onToggleFrozen?: (node: GraphNode) => void;
  isFrozen?: (node: GraphNode) => boolean;
  /** Host-supplied actions for the footer — e.g. "pin to chat". */
  actions?: ReactNode;
  className?: string;
  width?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
}

/**
 * Details for the selected node or relationship.
 *
 * A drawer over the canvas, not a rail beside it. A rail is the obvious
 * layout and it is wrong here: it takes its width from the graph permanently,
 * so selecting a node — the one gesture that means "I want to look at this
 * more closely" — is also the gesture that shrinks what you are looking at.
 * Over the canvas, the graph keeps its full width and the drawer is dismissed
 * the moment you are done with it.
 *
 * Also the accessible surface for the graph: the canvas itself is opaque to a
 * screen reader, so everything a sighted user learns by hovering has to be
 * readable here as ordinary DOM.
 */
export function GraphInspector({
  selection,
  colorForLabel,
  captionOf,
  onClose,
  onExpandNode,
  onToggleFrozen,
  isFrozen,
  actions,
  className,
  width = GRAPH_INSPECTOR_WIDTH,
  maxWidth = 640,
  onWidthChange,
}: GraphInspectorProps) {
  const minimumWidth = Math.min(240, maxWidth);
  const clampWidth = (value: number) => Math.max(minimumWidth, Math.min(maxWidth, value));
  width = clampWidth(width);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const { node, edge } = selection;
  const open = Boolean(node || edge);

  // Escape closes, matching every other dismissible surface. Bound to the
  // window rather than the drawer because the canvas keeps keyboard focus —
  // people select with the mouse and expect Escape to work without clicking
  // into the panel first.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // One press, one dismissal. The host's tool panel listens for Escape on
      // the window too, and it was registered first (it mounts before a
      // selection exists), so in the bubble phase it ran first and closed the
      // WHOLE graph panel out from under the drawer this key was meant for.
      //
      // Hence capture: a capture listener on `window` runs before every bubble
      // listener on it, and `stopPropagation` there ends the trip — the event
      // never reaches the target and never bubbles back. `preventDefault` as
      // well, for any handler that guards on `defaultPrevented` instead.
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!node && !edge) return null;

  const frozen = node ? Boolean(isFrozen?.(node)) : false;

  return (
    // Non-modal, and pointer-transparent everywhere but the drawer itself.
    // No scrim, no click-catcher: with the graph covered by an invisible
    // button you cannot click the next node, pan, or zoom while a node's
    // details are open — which is most of what you do with a graph. Dismissal
    // is the close button, Escape, or simply selecting something else.
    <div className={cn("pointer-events-none absolute inset-0 z-20 flex justify-end", className)}>
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={node ? "Selected node" : "Selected relationship"}
        style={{ width }}
        className="foundry-graph-drawer relative border-border bg-background pointer-events-auto flex h-full max-w-[85%] flex-col border-l shadow-2xl"
      >
        {onWidthChange && (
          <div
            role="separator"
            aria-label="Resize graph details"
            aria-orientation="vertical"
            aria-valuemin={minimumWidth}
            aria-valuemax={maxWidth}
            aria-valuenow={width}
            tabIndex={0}
            className="absolute -left-1 top-0 z-30 h-full w-2 cursor-col-resize touch-none hover:bg-muted-foreground/20 focus-visible:bg-muted-foreground/20 focus-visible:outline-none"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              drag.current = { x: event.clientX, width };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (drag.current)
                onWidthChange(clampWidth(drag.current.width + drag.current.x - event.clientX));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              if (drag.current) onWidthChange(drag.current.width);
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onDoubleClick={() => onWidthChange(clampWidth(GRAPH_INSPECTOR_WIDTH))}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                onWidthChange(clampWidth(width + (event.key === "ArrowLeft" ? 32 : -32)));
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                onWidthChange(event.key === "Home" ? minimumWidth : maxWidth);
              }
            }}
          />
        )}
        <header className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {node ? (
              <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForLabel(primaryLabel(node)) }}
                />
                {(node.labels?.length ? node.labels : ["Node"]).join(" · ")}
              </p>
            ) : (
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                Relationship
              </p>
            )}
            <h2 className="text-foreground truncate text-base font-semibold" title={headingOf()}>
              {headingOf()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="border-border text-muted-foreground hover:bg-muted focus-visible:ring-ring rounded-lg border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <PropertyRows properties={(node ?? (edge as GraphEdge)).properties} />
        </div>

        {node && (onExpandNode || onToggleFrozen || actions) && (
          <footer className="border-border flex items-center justify-end gap-1.5 border-t px-4 py-3">
            {actions}
            {onToggleFrozen && (
              <button
                type="button"
                onClick={() => onToggleFrozen(node)}
                aria-pressed={frozen}
                title={frozen ? "Let the layout move this node" : "Freeze this node in place"}
                className={cn(
                  "border-border hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1",
                  frozen ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Snowflake className="size-3.5" />
                {frozen ? "Frozen" : "Freeze"}
              </button>
            )}
            {onExpandNode && (
              <button
                type="button"
                onClick={() => onExpandNode(node)}
                title="Load this node's neighbours"
                className="border-border hover:bg-muted text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1"
              >
                <Maximize2 className="size-3.5" />
                Expand
              </button>
            )}
          </footer>
        )}
      </aside>
    </div>
  );

  function headingOf(): string {
    if (node) return captionOf(node) || resolveCaption(node);
    return edge ? edgeCaption(edge) : "RELATED";
  }
}
