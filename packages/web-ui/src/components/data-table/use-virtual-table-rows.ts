import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { flushSync } from "react-dom";
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
    const media = typeof window.matchMedia === "function" ? window.matchMedia("print") : null;
    const beforePrint = () => flushSync(() => setPrinting(true));
    const afterPrint = () => setPrinting(false);
    const update = () => (media?.matches ? beforePrint() : afterPrint());
    if (media?.matches) setPrinting(true);
    media?.addEventListener("change", update);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      media?.removeEventListener("change", update);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
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
  const rowIndexes = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);
  const activeIndex = activeRowId == null ? -1 : (rowIndexes.get(activeRowId) ?? -1);
  const focusedIndex = focusedRowId == null ? -1 : (rowIndexes.get(focusedRowId) ?? -1);
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
    // Native tr bounds include incorrect table-border heights in Firefox.
    // Cells share the laid-out row height and retain wrapped-content measurement.
    measureElement: (element) =>
      Math.max(0, ...Array.from(element.cells, (cell) => cell.getBoundingClientRect().height)) ||
      (dense ? 32 : 48),
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
