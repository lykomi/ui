import { useCallback, useEffect, useState, type RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Row } from "@tanstack/react-table";

/** Window the rendered rows, retaining native table layout and a focused cell. */
export function useVirtualTableRows<T>({
  rows,
  scroller,
  body,
  bounded,
  dense,
  activeRowId,
}: {
  rows: Row<T>[];
  scroller: RefObject<HTMLDivElement | null>;
  body: RefObject<HTMLTableSectionElement | null>;
  bounded: boolean;
  dense: boolean;
  activeRowId?: string | null;
}) {
  const [printing, setPrinting] = useState(false);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(40);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("print");
    const update = () => setPrinting(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const header = body.current?.parentElement?.querySelector("thead");
    if (!header) return;
    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, [body]);
  const enabled = bounded && rows.length > 200 && !printing;
  const activeIndex = rows.findIndex((row) => row.id === activeRowId);
  const focusedIndex = rows.findIndex((row) => row.id === focusedRowId);
  const rangeExtractor = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) => {
      const indexes = new Set(defaultRangeExtractor(range));
      if (activeIndex >= 0) indexes.add(activeIndex);
      if (focusedIndex >= 0) indexes.add(focusedIndex);
      return [...indexes].sort((a, b) => a - b);
    },
    [activeIndex, focusedIndex],
  );
  const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => (dense ? 32 : 48),
    getItemKey,
    overscan: 8,
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    initialRect: { width: 0, height: 600 },
    rangeExtractor,
    enabled,
  });
  // A shorter projection must not strand the viewport beyond its new end.
  useEffect(() => {
    const element = scroller.current;
    if (!enabled || !element) return;
    const max = Math.max(0, virtualizer.getTotalSize() + headerHeight - element.clientHeight);
    if (element.scrollTop > max) element.scrollTop = max;
  }, [enabled, rows.length, virtualizer, headerHeight, scroller]);
  const items = enabled
    ? virtualizer.getVirtualItems()
    : rows.map((_, index) => ({
        index,
        start: 0,
        end: 0,
        key: rows[index].id,
      }));
  return {
    enabled,
    items,
    measureElement: enabled ? virtualizer.measureElement : undefined,
    before: (index: number) =>
      enabled ? Math.max(0, items[index].start - (index ? items[index - 1].end : headerHeight)) : 0,
    after: enabled
      ? Math.max(
          0,
          virtualizer.getTotalSize() -
            ((items[items.length - 1]?.end ?? headerHeight) - headerHeight),
        )
      : 0,
    setFocusedRowId,
  };
}
