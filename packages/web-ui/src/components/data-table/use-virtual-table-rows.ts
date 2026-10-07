import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { flushSync } from "react-dom";
import { tabbable } from "tabbable";
import type { Row } from "@tanstack/react-table";

/** Include the roving row as well as native cell controls. */
function tabTargets(root: HTMLElement) {
  return tabbable(root, { includeContainer: true, displayCheck: "non-zero-area" });
}

/** Window the rendered rows, retaining native table layout and a focused cell. */
export function useVirtualTableRows<T>({
  rows,
  scroller,
  body,
  bounded,
  dense,
  activeRowId,
  mayHaveTabStops,
}: {
  rows: Row<T>[];
  scroller: RefObject<HTMLDivElement | null>;
  body: RefObject<HTMLTableSectionElement | null>;
  bounded: boolean;
  dense: boolean;
  activeRowId?: string | null;
  mayHaveTabStops: (row: Row<T>) => boolean;
}) {
  const [pendingTab, setPendingTab] = useState<{
    index: number;
    direction: 1 | -1;
    rows: Row<T>[];
    anchor: HTMLElement;
  } | null>(null);
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
  const candidates = useMemo(
    () => rows.flatMap((row, index) => (mayHaveTabStops(row) ? [index] : [])),
    [rows, mayHaveTabStops],
  );
  const hasTabTargets = candidates.length > 0;
  const candidateWindow = useCallback(
    (index: number, direction: 1 | -1) => {
      let low = 0,
        high = candidates.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (candidates[middle] < index) low = middle + 1;
        else high = middle;
      }
      if (direction === 1) return candidates.slice(low, low + 32);
      const end = low < candidates.length && candidates[low] === index ? low + 1 : low;
      return candidates.slice(Math.max(0, end - 32), end).reverse();
    },
    [candidates],
  );
  const handingOff = useRef(false);
  useEffect(() => {
    const update = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const mounted =
        body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-virtual-row-id]") ?? [];
      for (const row of mounted) {
        const owned = (root: HTMLElement, visited = new Set<string>()): boolean => {
          if (root.contains(target)) return true;
          for (const control of root.querySelectorAll("[aria-controls], [aria-owns]")) {
            const ids =
              `${control.getAttribute("aria-controls") ?? ""} ${control.getAttribute("aria-owns") ?? ""}`
                .trim()
                .split(/\s+/);
            for (const id of ids) {
              if (!id || visited.has(id)) continue;
              visited.add(id);
              const portal = document.getElementById(id);
              if (portal && owned(portal, visited)) return true;
            }
          }
          return false;
        };
        if (owned(row)) {
          setFocusedRowId(row.dataset.virtualRowId ?? null);
          return;
        }
      }
      setFocusedRowId(null);
    };
    document.addEventListener("focusin", update);
    return () => document.removeEventListener("focusin", update);
  }, [body]);
  const rangeExtractor = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) => {
      const indexes = new Set(defaultRangeExtractor(range));
      if (activeIndex >= 0) indexes.add(activeIndex);
      if (focusedIndex >= 0) indexes.add(focusedIndex);
      if (pendingTab?.rows === rows)
        for (const index of candidateWindow(pendingTab.index, pendingTab.direction))
          indexes.add(index);
      return [...indexes].sort((a, b) => a - b);
    },
    [activeIndex, focusedIndex, pendingTab, rows, candidateWindow],
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
  const onKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        !enabled ||
        !hasTabTargets ||
        event.key !== "Tab" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest<HTMLTableRowElement>("tr[data-virtual-row-id]");
      if (!row || !body.current?.contains(row)) {
        if (event.shiftKey) return;
        const header = body.current?.parentElement?.querySelector<HTMLElement>("thead");
        const headers = header ? tabTargets(header) : [];
        if (
          (target === scroller.current && !headers.length) ||
          target === headers[headers.length - 1]
        ) {
          event.preventDefault();
          setPendingTab({ index: 0, direction: 1, rows, anchor: target });
        }
        return;
      }
      const targets = tabTargets(row);
      const direction = event.shiftKey ? -1 : 1;
      if (target !== targets[direction === 1 ? targets.length - 1 : 0]) return;
      const index = Number(row.dataset.index) + direction;
      if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
      if (!candidateWindow(index, direction).length) return;
      event.preventDefault();
      setPendingTab({ index, direction, rows, anchor: target });
    },
    [enabled, hasTabTargets, rows, body, scroller, candidateWindow],
  );
  useEffect(() => {
    if (!pendingTab) return;
    if (!enabled || pendingTab.rows !== rows || document.activeElement !== pendingTab.anchor) {
      setPendingTab(null);
      return;
    }
    const mounted = new Map(
      Array.from(
        body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-virtual-row-id]") ?? [],
      ).map((row) => [row.dataset.virtualRowId, row]),
    );
    const window = candidateWindow(pendingTab.index, pendingTab.direction);
    for (const index of window) {
      const element = mounted.get(rows[index].id);
      if (!element) return;
      const targets = tabTargets(element);
      for (const target of pendingTab.direction === 1 ? targets : [...targets].reverse()) {
        target.focus();
        if (document.activeElement === target) {
          setPendingTab(null);
          return;
        }
      }
    }
    const index = (window[window.length - 1] ?? pendingTab.index) + pendingTab.direction;
    if (window.length && candidateWindow(index, pendingTab.direction).length) {
      // Let React schedule the next bounded commit without adding a fixed
      // animation-frame delay for every chunk of empty rows.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setPendingTab({ ...pendingTab, index });
      });
      return () => {
        cancelled = true;
      };
    }
    // No remaining cell targets: continue into the surrounding native tab order.
    const table = body.current?.parentElement;
    if (table) {
      const outside = tabTargets(document.body).filter(
        (target) =>
          !table.contains(target) &&
          !target.hasAttribute("data-virtual-boundary") &&
          Boolean(
            table.compareDocumentPosition(target) &
            (pendingTab.direction === 1
              ? Node.DOCUMENT_POSITION_FOLLOWING
              : Node.DOCUMENT_POSITION_PRECEDING),
          ),
      );
      const header = table.querySelector<HTMLElement>("thead");
      const headers = header ? tabTargets(header) : [];
      const destination =
        pendingTab.direction === 1
          ? outside[0]
          : (headers[headers.length - 1] ?? outside[outside.length - 1]);
      if (destination) destination.focus();
      else if (pendingTab.direction === 1) {
        handingOff.current = true;
        scroller.current?.querySelector<HTMLElement>("[data-virtual-boundary]")?.focus();
        handingOff.current = false;
      }
    }
    setPendingTab(null);
  }, [pendingTab, enabled, rows, items, body, scroller, candidateWindow]);
  return {
    enabled,
    hasTabTargets,
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
    onKeyDownCapture,
    onBoundaryFocus: (anchor: HTMLElement, direction: 1 | -1) => {
      if (handingOff.current) return;
      setPendingTab({
        index: direction === 1 ? rows.length : rows.length - 1,
        direction,
        rows,
        anchor,
      });
    },
  };
}
