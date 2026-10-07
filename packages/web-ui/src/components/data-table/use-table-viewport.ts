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
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) candidates.push(parent);
    }
    // Once an actual scrollport is identified, retain it even after fitting
    // removes its overflow; otherwise its bottom and the window would alternate.
    let pane: HTMLElement | undefined;
    let observer: ResizeObserver | undefined;
    let pending: number | undefined;
    const read = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (!pane) {
        pane = candidates.find((parent) => parent.scrollHeight > parent.clientHeight + 1);
        if (pane) observer?.observe(pane);
      }
      const bottom = Math.min(
        window.innerHeight,
        pane ? pane.getBoundingClientRect().top + pane.clientTop + pane.clientHeight : Infinity,
      );
      const footer =
        frame?.querySelector("[data-table-overflow]")?.getBoundingClientRect().height ?? 0;
      // Leave one action row plus normal breathing room below the scrollbar.
      const next = Math.max(128, Math.floor(bottom - rect.top - footer - 48));
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
