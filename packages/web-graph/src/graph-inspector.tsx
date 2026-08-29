import { X } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { primaryLabel, type GraphEdge, type GraphNode } from "./model.ts";
import type { GraphSelection } from "./use-graph-view-state.ts";

/** Render a property value without collapsing structure into "[object Object]". */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function PropertyTable({ properties }: { properties: Record<string, unknown> | undefined }) {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">No properties.</p>;
  }
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground truncate font-medium">{key}</dt>
          <dd className="text-foreground break-words">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface GraphInspectorProps {
  selection: GraphSelection;
  colorForLabel: (label: string) => string;
  /** The same caption the canvas draws — resolved once by the styling hook. */
  captionOf: (node: GraphNode) => string;
  onClose: () => void;
  /** Rendered as an "Expand" action when the host supplies one. */
  onExpandNode?: (node: GraphNode) => void;
  /** Rendered as a "Pin"/"Unpin" toggle. */
  onTogglePin?: (node: GraphNode) => void;
  isPinned?: (node: GraphNode) => boolean;
  className?: string;
}

/**
 * Details for the selected node or relationship.
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
  onTogglePin,
  isPinned,
  className,
}: GraphInspectorProps) {
  const { node, edge } = selection;
  if (!node && !edge) return null;

  return (
    <aside
      aria-label={node ? "Selected node" : "Selected relationship"}
      className={cn(
        "border-border bg-card text-card-foreground flex max-h-full w-64 flex-col overflow-hidden rounded-md border shadow-sm",
        className,
      )}
    >
      <header className="border-border flex items-start gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          {node ? (
            <NodeHeading node={node} colorForLabel={colorForLabel} caption={captionOf(node)} />
          ) : null}
          {edge ? (
            <p className="text-foreground truncate text-xs font-semibold">
              {edge.type ?? "RELATED"}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded focus-visible:outline-none focus-visible:ring-1"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <PropertyTable properties={(node ?? (edge as GraphEdge)).properties} />
      </div>

      {node && (onExpandNode || onTogglePin) && (
        <footer className="border-border flex gap-2 border-t px-3 py-2">
          {onExpandNode && (
            <button
              type="button"
              onClick={() => onExpandNode(node)}
              className="border-border hover:bg-accent focus-visible:ring-ring rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
            >
              Expand
            </button>
          )}
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(node)}
              className="border-border hover:bg-accent focus-visible:ring-ring rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
            >
              {isPinned?.(node) ? "Unpin" : "Pin"}
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}

function NodeHeading({
  node,
  colorForLabel,
  caption,
}: {
  node: GraphNode;
  colorForLabel: (label: string) => string;
  caption: string;
}) {
  const labels = node.labels?.length ? node.labels : ["Node"];
  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {labels.map((label) => (
          <span key={label} className="inline-flex items-center gap-1 text-xs">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: colorForLabel(primaryLabel(node)) }}
            />
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
      <p className="text-foreground mt-0.5 truncate text-xs font-semibold" title={caption}>
        {caption}
      </p>
    </>
  );
}
