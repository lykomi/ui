import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@lykomi/web-primitives";

export const DATA_TABLE_PAGE_OVERFLOW_HEIGHT = 40;
export const DATA_TABLE_PAGE_OVERFLOW_WIDTH = 96;

/** Discoverable, keyboard-accessible navigation for a table wider than its pane. */
export function DataTableOverflow({
  scroller,
  compact = false,
  stickyTop,
}: {
  scroller: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  stickyTop?: number | string;
}) {
  const [edges, setEdges] = useState({ previous: false, next: false });
  const overflowing = edges.previous || edges.next;
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => {
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      const position = Math.abs(element.scrollLeft);
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
    <div
      data-table-overflow=""
      className={cn(
        "flex shrink-0 items-center gap-2",
        compact ? "justify-end bg-transparent" : "border-t border-border bg-card px-3 py-1",
      )}
      style={
        stickyTop === undefined
          ? undefined
          : {
              position: "sticky",
              top: stickyTop,
              zIndex: 12,
              height: DATA_TABLE_PAGE_OVERFLOW_HEIGHT,
              marginBottom: -DATA_TABLE_PAGE_OVERFLOW_HEIGHT,
              pointerEvents: "none",
            }
      }
    >
      {compact ? (
        <span className="sr-only">Scroll to see more columns</span>
      ) : (
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          Scroll to see more columns
        </span>
      )}
      <div
        className={cn(
          "flex items-center gap-1",
          compact && "pointer-events-auto ml-auto justify-center border-l border-border bg-card",
        )}
        style={compact ? { width: DATA_TABLE_PAGE_OVERFLOW_WIDTH } : undefined}
        role="group"
        aria-label="Scroll table columns"
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 shrink-0 [@media(pointer:coarse)]:size-11",
            compact && !edges.previous && "opacity-40",
          )}
          aria-label="Previous columns"
          aria-disabled={compact && !edges.previous ? true : undefined}
          tabIndex={compact && !edges.previous ? -1 : undefined}
          disabled={!compact && !edges.previous}
          onClick={() => {
            if (edges.previous) move(-1);
          }}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 shrink-0 [@media(pointer:coarse)]:size-11",
            compact && !edges.next && "opacity-40",
          )}
          aria-label="Next columns"
          aria-disabled={compact && !edges.next ? true : undefined}
          tabIndex={compact && !edges.next ? -1 : undefined}
          disabled={!compact && !edges.next}
          onClick={() => {
            if (edges.next) move(1);
          }}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
