import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@lykomi/web-primitives";

export interface DataTableLoadMoreOptions {
  hasMore: boolean;
  loading?: boolean;
  /** Resolve after the next batch has been added; reject to offer a retry. */
  onLoadMore: () => Promise<unknown>;
  /** Change when the remote query changes, even if the row count stays the same. */
  resetKey?: string | number;
}

/** Lives INSIDE the table's scrollport, after the virtualized rows. */
export function DataTableLoadMore({
  options,
  rowCount,
  scroller,
  pageScrolling,
}: {
  options: DataTableLoadMoreOptions;
  rowCount: number;
  scroller: RefObject<HTMLDivElement | null>;
  pageScrolling: boolean;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  latest.current = options;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const attempted = useRef<string | null>(null);
  const progress = JSON.stringify([options.resetKey, rowCount]);
  const currentProgress = useRef(progress);
  currentProgress.current = progress;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setError(null);
  }, [options.resetKey]);

  const load = async (automatic: boolean) => {
    if (inFlight.current || latest.current.loading || !latest.current.hasMore) return;
    const key = currentProgress.current;
    // A server returning no new rows must not cause an unbounded request loop.
    if (automatic && attempted.current === key) return;
    attempted.current = key;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await latest.current.onLoadMore();
    } catch {
      if (mounted.current && currentProgress.current === key)
        setError("Could not load more rows. Try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (
      !options.hasMore ||
      options.loading ||
      pending ||
      !marker.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadRef.current(true);
      },
      { root: pageScrolling ? null : scroller.current, rootMargin: "160px 0px" },
    );
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [options.hasMore, options.loading, pending, progress, pageScrolling, scroller]);

  return (
    <div
      ref={marker}
      data-table-load-more=""
      className="flex min-h-12 flex-wrap items-center justify-center gap-2 p-2 text-sm text-muted-foreground"
    >
      {error ? <span role="alert">{error}</span> : null}
      {options.hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || options.loading}
          onClick={() => void load(false)}
        >
          {pending || options.loading ? "Loading more…" : error ? "Retry loading" : "Load more"}
        </Button>
      ) : (
        <span role="status">All rows loaded</span>
      )}
    </div>
  );
}
