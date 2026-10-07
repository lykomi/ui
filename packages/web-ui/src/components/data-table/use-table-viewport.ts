import { useLayoutEffect, useState, type RefObject } from "react";

/** Keep a bounded list's footer inside the visible viewport, including in a pane. */
export function useTableViewport(scroller: RefObject<HTMLDivElement | null>, enabled: boolean) {
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
    const read = () => {
      const ancestors: HTMLElement[] = [];
      for (
        let parent = frame?.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        ancestors.push(parent);
      }
      const layout = frame?.closest("[data-table-layout]");
      const actions = Array.from(
        layout?.querySelectorAll<HTMLElement>("[data-table-footer]") ?? [],
      ).find(
        (footer) =>
          frame !== null &&
          footer.closest("[data-table-layout]") === layout &&
          !frame.contains(footer) &&
          Boolean(frame.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
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
        window.innerHeight,
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
      const next = Math.max(0, Math.floor(bottom - rect.top - footer - actionSpace));
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
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    read();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      if (pending !== undefined) cancelAnimationFrame(pending);
    };
  }, [scroller, enabled]);
  return enabled ? viewport : { height: undefined, paginated: false };
}
