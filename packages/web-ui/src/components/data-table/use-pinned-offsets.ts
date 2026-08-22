/**
 * Left offsets for pinned columns. A pinned column sticks to the left edge
 * of the scroll container; the ones after it stack behind their predecessors,
 * so each needs the summed width of the pinned columns before it. Widths are
 * measured from the rendered header cells (a column's declared `size` is a
 * hint, not the used width) and kept current with a `ResizeObserver`.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface PinnedOffsets {
  /** `columnId → left offset in px`, for the columns that are pinned. */
  offsets: Record<string, number>;
  /** The id of the last pinned column, which carries the edge shadow. */
  lastPinned: string | null;
  /** Attach to each pinned header cell so its width is tracked. */
  measure: (columnId: string) => (element: HTMLElement | null) => void;
}

export function usePinnedOffsets(pinnedIds: readonly string[]): PinnedOffsets {
  const elements = useRef(new Map<string, HTMLElement>());
  const [widths, setWidths] = useState<Record<string, number>>({});
  const key = pinnedIds.join(",");

  const read = useCallback(() => {
    setWidths((current) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, element] of elements.current) {
        const width = element.getBoundingClientRect().width;
        next[id] = width;
        if (Math.abs((current[id] ?? -1) - width) > 0.5) changed = true;
      }
      if (!changed && Object.keys(next).length === Object.keys(current).length) return current;
      return next;
    });
  }, []);

  const observerRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observerRef.current = observer;
    for (const element of elements.current.values()) observer.observe(element);
    read();
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, read]);

  // One stable callback per column: a fresh ref callback on every render
  // would make React detach and re-attach the ref each time.
  const callbacks = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const measure = useCallback(
    (columnId: string) => {
      const existing = callbacks.current.get(columnId);
      if (existing) return existing;
      const callback = (element: HTMLElement | null) => {
        const previous = elements.current.get(columnId);
        if (previous === element) return;
        if (previous) observerRef.current?.unobserve(previous);
        if (element) {
          elements.current.set(columnId, element);
          observerRef.current?.observe(element);
        } else {
          elements.current.delete(columnId);
        }
        read();
      };
      callbacks.current.set(columnId, callback);
      return callback;
    },
    [read],
  );

  const offsets: Record<string, number> = {};
  let running = 0;
  for (const id of pinnedIds) {
    offsets[id] = running;
    running += widths[id] ?? 0;
  }
  return {
    offsets,
    lastPinned: pinnedIds.length ? pinnedIds[pinnedIds.length - 1]! : null,
    measure,
  };
}
