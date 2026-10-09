import { useEffect, useRef, useState } from "react";

const empty = { overflow: false, previous: false, next: false };

/** Scroll only the rail: inspecting a step must never move the surrounding page. */
export function useProcessScroll(inspectedId: string | undefined, layoutKey: string) {
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState(empty);
  const horizontal = () =>
    !!track.current && getComputedStyle(track.current).flexDirection === "row";
  const reducedMotion = () =>
    !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal = (element: HTMLElement, behavior: ScrollBehavior = "auto") => {
    const view = viewport.current;
    if (!view || !horizontal()) return;
    const bounds = view.getBoundingClientRect();
    const item = element.getBoundingClientRect();
    const rtl = getComputedStyle(view).direction === "rtl";
    const inset = 8;
    const left = item.left - bounds.left - inset;
    const right = item.right - bounds.right + inset;
    const delta =
      item.width > bounds.width - inset * 2
        ? rtl
          ? right
          : left
        : left < 0
          ? left
          : right > 0
            ? right
            : 0;
    if (Math.abs(delta) > 1) view.scrollBy?.({ left: delta, behavior });
  };
  const move = (direction: number, physical = false) => {
    const view = viewport.current;
    if (!view || !horizontal()) return;
    const sign = !physical && getComputedStyle(view).direction === "rtl" ? -1 : 1;
    view.scrollBy?.({
      left: direction * sign * view.clientWidth * 0.8,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    const view = viewport.current;
    const list = track.current;
    const outer = frame.current;
    if (!view || !list || !outer) return;
    const read = () => {
      const bounds = view.getBoundingClientRect();
      const first = list.firstElementChild?.getBoundingClientRect();
      const last = list.lastElementChild?.getBoundingClientRect();
      const rtl = getComputedStyle(view).direction === "rtl";
      // Compare against the full frame so adding/removing controls cannot create
      // a history-dependent overflow threshold during a resize.
      const overflow = horizontal() && view.scrollWidth > outer.clientWidth + 1;
      const next = {
        overflow,
        previous:
          overflow &&
          !!first &&
          (rtl ? first.right > bounds.right + 1 : first.left < bounds.left - 1),
        next:
          overflow && !!last && (rtl ? last.left < bounds.left - 1 : last.right > bounds.right + 1),
      };
      setEdges((old) =>
        Object.keys(next).every(
          (key) => old[key as keyof typeof next] === next[key as keyof typeof next],
        )
          ? old
          : next,
      );
    };
    const revealSelected = () => {
      const selected = list.querySelector<HTMLElement>("[data-selected] .foundry-process-target");
      if (selected) reveal(selected);
    };
    const resize = () => {
      revealSelected();
      read();
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            revealSelected();
            read();
          });
    observer?.observe(view);
    observer?.observe(list);
    observer?.observe(outer);
    view.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", resize);
    read();
    return () => {
      observer?.disconnect();
      view.removeEventListener("scroll", read);
      window.removeEventListener("resize", resize);
    };
  }, [layoutKey, inspectedId]);

  useEffect(() => {
    const selected = track.current?.querySelector<HTMLElement>(
      "[data-selected] .foundry-process-target",
    );
    if (selected) reveal(selected);
    // Scroll events only update edge hints, so manual browsing is never snapped back.
  }, [inspectedId, layoutKey, edges.overflow]);

  return { frame, viewport, track, edges, reveal, move };
}
