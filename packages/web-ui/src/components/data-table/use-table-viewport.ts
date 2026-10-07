import { useLayoutEffect, useState, type RefObject } from "react";

/** Keep a bounded list's footer inside the visible viewport, including in a pane. */
export function useTableViewport(
  scroller: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  fitViewport = true,
) {
  const [viewport, setViewport] = useState<{ height?: number; paginated: boolean }>({
    paginated: false,
  });
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!enabled || !element) return;
    const frame = element.parentElement;
    // Once an actual scrollport is identified, retain it even after fitting
    // removes its overflow; otherwise its bottom and the window would alternate.
    const panes = new Set<HTMLElement>();
    let observer: ResizeObserver | undefined;
    const observed = new Set<HTMLElement>();
    let pending: number | undefined;
    let mutationObserver: MutationObserver | undefined;
    let styleObserver: MutationObserver | undefined;
    const styleObserved = new Set<Element>();
    let mutationLayout: Element | null | undefined;
    const read = () => {
      const ancestors: HTMLElement[] = [];
      for (
        let parent = frame?.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        ancestors.push(parent);
      }
      const styleTargets = new Set<Element>([
        ...(frame ? [frame] : []),
        ...ancestors,
        document.body,
        document.documentElement,
      ]);
      if (
        styleTargets.size !== styleObserved.size ||
        [...styleTargets].some((target) => !styleObserved.has(target))
      ) {
        styleObserver?.disconnect();
        styleObserved.clear();
        styleTargets.forEach((target) => {
          styleObserver?.observe(target, { attributes: true, attributeFilter: ["class", "style"] });
          styleObserved.add(target);
        });
      }
      const layout = frame?.closest("[data-table-layout]");
      if (layout !== mutationLayout) {
        mutationObserver?.disconnect();
        if (layout) mutationObserver?.observe(layout, { childList: true, subtree: true });
        mutationLayout = layout;
      }
      // A footer belongs to the preceding table, never a later table in
      // the same layout. Nested tables inside this frame are not siblings.
      const following = Array.from(
        layout?.querySelectorAll<HTMLElement>("[data-list-scroller], [data-table-footer]") ?? [],
      ).find(
        (node) =>
          frame !== null &&
          node.closest("[data-table-layout]") === layout &&
          !frame.contains(node) &&
          Boolean(frame.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
      const actions = following?.matches("[data-table-footer]") ? following : undefined;
      const targets = new Set([
        ...(frame ? [frame] : []),
        ...ancestors,
        ...(actions ? [actions] : []),
      ]);
      observed.forEach((target) => {
        if (!targets.has(target)) {
          observer?.unobserve(target);
          observed.delete(target);
        }
      });
      targets.forEach((target) => {
        if (!observed.has(target) && observer) {
          observer.observe(target);
          observed.add(target);
        }
      });
      // Responsive overflow styles can change without remounting the table.
      const candidates = ancestors.filter((parent) =>
        /auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY),
      );
      panes.forEach((pane) => {
        if (!candidates.includes(pane)) panes.delete(pane);
      });
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0) return;
      candidates.forEach((parent) => {
        if (parent.scrollHeight > parent.clientHeight + 1) panes.add(parent);
      });
      const bottom = Math.min(
        Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight),
        ...[...panes].map(
          (pane) => pane.getBoundingClientRect().top + pane.clientTop + pane.clientHeight,
        ),
      );
      const footer =
        frame?.querySelector("[data-table-overflow]")?.getBoundingClientRect().height ?? 0;
      // Pagination can wrap at narrow widths. Reserve its measured height and
      // gap, with a normal action-row fallback for custom layouts.
      const actionSpace =
        actions && frame
          ? Math.max(
              48,
              actions.getBoundingClientRect().bottom - frame.getBoundingClientRect().bottom + 16,
            )
          : 48;
      const next = fitViewport
        ? Math.max(0, Math.floor(bottom - rect.top - footer - actionSpace))
        : undefined;
      const paginated = Boolean(
        actions?.matches("[data-table-pagination]") ||
        actions?.querySelector("[data-table-pagination]"),
      );
      setViewport((current) =>
        current.height === next && current.paginated === paginated
          ? current
          : { height: next, paginated },
      );
    };
    const schedule = () => {
      if (pending !== undefined) return;
      pending = requestAnimationFrame(() => {
        pending = undefined;
        read();
      });
    };
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
    }
    if (typeof MutationObserver !== "undefined") {
      styleObserver = new MutationObserver(schedule);
      mutationObserver = new MutationObserver((records) => {
        const selector = "[data-table-footer], [data-table-pagination], [data-list-scroller]";
        if (
          records.some((record) =>
            [...record.addedNodes, ...record.removedNodes].some(
              (node) =>
                node instanceof Element && (node.matches(selector) || node.querySelector(selector)),
            ),
          )
        )
          schedule();
      });
    }
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    read();
    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      styleObserver?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      if (pending !== undefined) cancelAnimationFrame(pending);
    };
  }, [scroller, enabled, fitViewport]);
  return enabled ? viewport : { height: undefined, paginated: false };
}
