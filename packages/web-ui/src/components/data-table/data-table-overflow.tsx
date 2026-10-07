import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@iloveagents/foundry-web-primitives";

/** Discoverable, keyboard-accessible navigation for a table wider than its pane. */
export function DataTableOverflow({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const overflowing = edges.previous || edges.next;
  useLayoutEffect(() => {
    if (track.current && scroller.current) track.current.scrollLeft = scroller.current.scrollLeft;
  }, [trackWidth, overflowing, scroller]);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => {
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      setTrackWidth(maximum + (track.current?.clientWidth ?? 0));
      if (
        track.current &&
        Math.abs(track.current.scrollWidth - track.current.clientWidth - maximum) < 1 &&
        Math.abs(track.current.scrollLeft - element.scrollLeft) > 1
      )
        track.current.scrollLeft = element.scrollLeft;
      const position = Math.abs(element.scrollLeft);
      const next = { previous: position > 1, next: position < maximum - 1 };
      setEdges((current) =>
        current.previous === next.previous && current.next === next.next ? current : next,
      );
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(element);
    if (track.current) observer?.observe(track.current);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    element.addEventListener("scroll", read, { passive: true });
    read();
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", read);
    };
  }, [scroller, overflowing]);
  if (!overflowing) return null;
  const move = (direction: number) => {
    const element = scroller.current;
    if (!element) return;
    const sign = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    element.scrollBy({
      left: direction * sign * Math.max(160, element.clientWidth * 0.7),
      behavior:
        !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
    });
  };
  return (
    <div data-table-overflow="" className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-1">
      <div
        ref={track}
        data-list-scroller=""
        role="region"
        aria-label="Horizontal column scrollbar"
        tabIndex={0}
        className="h-4 min-w-0 flex-1 overflow-x-auto overflow-y-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onScroll={(event) => {
          const element = scroller.current;
          if (element && Math.abs(element.scrollLeft - event.currentTarget.scrollLeft) > 1)
            element.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div style={{ width: trackWidth, height: 1 }} />
      </div>
      <span className="sr-only">Scroll to see more columns</span>
      <div className="flex items-center gap-1" role="group" aria-label="Scroll table columns">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 [@media(pointer:coarse)]:size-11"
          aria-label="Previous columns"
          disabled={!edges.previous}
          onClick={() => move(-1)}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 [@media(pointer:coarse)]:size-11"
          aria-label="Next columns"
          disabled={!edges.next}
          onClick={() => move(1)}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
