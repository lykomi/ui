import { cn } from "@lykomi/web-primitives";
import type { GraphStyleMap } from "./use-graph-styling.ts";

export interface GraphLegendProps {
  styleMap: GraphStyleMap;
  /** Node count per label, so the legend doubles as a breakdown. */
  counts: ReadonlyMap<string, number>;
  hiddenLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  onShowAll: () => void;
  className?: string;
}

/**
 * Colour key for node labels, and the filter control.
 *
 * Clicking a label hides that type — the fastest way to make a dense graph
 * readable, and the one interaction Bloom users reach for first. Rendered as
 * real `<button>`s so the filter is keyboard-reachable; the canvas beside it
 * is not.
 */
export function GraphLegend({
  styleMap,
  counts,
  hiddenLabels,
  onToggleLabel,
  onShowAll,
  className,
}: GraphLegendProps) {
  if (styleMap.labels.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {styleMap.labels.map((label) => {
        const hidden = hiddenLabels.has(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggleLabel(label)}
            aria-pressed={!hidden}
            title={`${hidden ? "Show" : "Hide"} ${legendTitle(styleMap.nameForLabel(label), label)}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              hidden
                ? "border-border text-muted-foreground opacity-60"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: styleMap.colorForLabel(label) }}
            />
            <span className={cn(hidden && "line-through")}>{styleMap.nameForLabel(label)}</span>
            <span className="text-muted-foreground tabular-nums">{counts.get(label) ?? 0}</span>
          </button>
        );
      })}
      {hiddenLabels.size > 0 && (
        <button
          type="button"
          onClick={onShowAll}
          className="rounded-full px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Show all
        </button>
      )}
    </div>
  );
}

/** The label's name, and the label itself when the two differ. */
function legendTitle(name: string, label: string): string {
  return name === label ? label : `${name} (${label})`;
}
