import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@iloveagents/foundry-web-primitives";

/** Discoverable, keyboard-accessible navigation for a table wider than its pane. */
export function DataTableOverflow({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const [edges, setEdges] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => {
      const position = Math.abs(element.scrollLeft);
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      const next = { previous: position > 1, next: position < maximum - 1 };
      setEdges((current) =>
        current.previous === next.previous && current.next === next.next ? current : next,
      );
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    element.addEventListener("scroll", read, { passive: true });
    read();
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", read);
    };
  }, [scroller]);
  if (!edges.previous && !edges.next) return null;
  const move = (direction: number) => {
    const element = scroller.current;
    if (!element) return;
    const sign = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    element.scrollBy({
      left: direction * sign * Math.max(160, element.clientWidth * 0.7),
      behavior: "auto",
    });
  };
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1 text-xs text-muted-foreground">
      <span>{edges.next ? "More columns to explore" : "You’re at the last column"}</span>
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
