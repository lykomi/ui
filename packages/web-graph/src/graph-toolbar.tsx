import { Maximize2, PinOff, Play, Search, Share2, Table2, X } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";

export interface GraphToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  /** Number of nodes matching the query — shown next to the search box. */
  matchCount: number;
  nodeCount: number;
  edgeCount: number;
  onZoomToFit: () => void;
  onReheat: () => void;
  pinnedCount: number;
  onUnpinAll: () => void;
  /**
   * Whether the table is showing, and how to swap. Omitted where there is no
   * choice to offer — a host that pinned the view with `forceTable`, or an
   * environment with no canvas at all.
   */
  showsTable?: boolean;
  onToggleTable?: () => void;
  className?: string;
}

const iconButton =
  "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-1";

/** Search, layout controls and element counts. */
export function GraphToolbar({
  query,
  onQueryChange,
  matchCount,
  nodeCount,
  edgeCount,
  onZoomToFit,
  onReheat,
  pinnedCount,
  onUnpinAll,
  showsTable,
  onToggleTable,
  className,
}: GraphToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="border-border bg-card focus-within:ring-ring flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1 focus-within:ring-1">
        <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search nodes…"
          aria-label="Search nodes"
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        {query.length > 0 && (
          <>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {matchCount}
            </span>
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="size-3" />
            </button>
          </>
        )}
      </div>

      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {nodeCount} nodes · {edgeCount} rels
      </span>

      {/* The canvas is one opaque element to assistive technology, and no
          amount of labelling changes that — the nodes and relationships are
          pixels. The table is the same data as a real DOM tree, so the honest
          answer is to make it reachable rather than to describe a picture.
          A control, not a permanently mounted duplicate: a capped graph is
          still 1,500 rows nobody asked for. */}
      {onToggleTable && (
        <button
          type="button"
          onClick={onToggleTable}
          title={showsTable ? "Show the graph" : "Show as a table"}
          aria-pressed={showsTable}
          className={iconButton}
        >
          {showsTable ? <Share2 className="size-3.5" /> : <Table2 className="size-3.5" />}
          <span className="sr-only">{showsTable ? "Show the graph" : "Show as a table"}</span>
        </button>
      )}
      {pinnedCount > 0 && (
        <button type="button" onClick={onUnpinAll} title="Unpin all nodes" className={iconButton}>
          <PinOff className="size-3.5" />
          <span className="sr-only">Unpin all nodes</span>
        </button>
      )}
      <button type="button" onClick={onReheat} title="Restart layout" className={iconButton}>
        <Play className="size-3.5" />
        <span className="sr-only">Restart layout</span>
      </button>
      <button type="button" onClick={onZoomToFit} title="Zoom to fit" className={iconButton}>
        <Maximize2 className="size-3.5" />
        <span className="sr-only">Zoom to fit</span>
      </button>
    </div>
  );
}
