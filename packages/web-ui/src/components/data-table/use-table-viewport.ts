import { useLayoutEffect, useState, type RefObject } from "react";

/** Keep a bounded list's footer inside the visible viewport, including in a pane. */
export function useTableViewport(scroller: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!enabled || !element) return;
    const frame = element.parentElement;
    const candidates: HTMLElement[] = [];
    for (
      let parent = frame?.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) candidates.push(parent);
    }
    // Once an actual scrollport is identified, retain it even after fitting
    // removes its overflow; otherwise its bottom and the window would alternate.
    const panes = new Set<HTMLElement>();
    let observer: ResizeObserver | undefined;
    let pending: number | undefined;
    const read = () => {
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
      // Leave one action row plus normal breathing room below the scrollbar.
      const next = Math.max(0, Math.floor(bottom - rect.top - footer - 48));
      setHeight((current) => (current === next ? current : next));
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
      if (frame) observer.observe(frame);
      if (frame?.parentElement) observer.observe(frame.parentElement);
      candidates.forEach((candidate) => observer!.observe(candidate));
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
  return enabled ? height : undefined;
}
