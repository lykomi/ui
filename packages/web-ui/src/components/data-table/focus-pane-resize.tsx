import { useEffect, useRef, useState } from "react";

/** Resize a focus-view side pane without remounting its chat or source. */
export function FocusPaneResize({
  label,
  side,
  width,
  onResize,
  breakpoint = "md",
}: {
  breakpoint?: "md" | "xl";
  label: string;
  side: "left" | "right";
  width?: number;
  onResize: (width?: number) => void;
}) {
  const start = useRef<{ x: number; width: number; original?: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const [maximum, setMaximum] = useState(880);
  const getMaximum = (element: HTMLElement) => {
    const pane = element.parentElement!;
    const dialog = pane.closest('[role="dialog"]');
    const other = [...(dialog?.querySelectorAll(":scope > aside") ?? [])]
      .filter((n) => n !== pane && !["absolute", "fixed"].includes(getComputedStyle(n).position))
      .reduce((sum, n) => sum + n.getBoundingClientRect().width, 0);
    return Math.max(240, (dialog?.getBoundingClientRect().width ?? 1200) - other - 320);
  };
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const update = () => {
      const maximum = getMaximum(element);
      setMaximum(maximum);
      // Automatic percentage widths obey the same content reserve as a drag.
      if (
        getComputedStyle(element).display !== "none" &&
        element.parentElement!.getBoundingClientRect().width > maximum
      )
        onResize(maximum);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    const dialog = element.closest('[role="dialog"]');
    if (dialog) {
      observer.observe(dialog);
      dialog.querySelectorAll(":scope > aside").forEach((pane) => observer.observe(pane));
    }
    return () => observer.disconnect();
  }, [onResize]);
  const adjust = (element: HTMLElement, next: number) => {
    const maximum = getMaximum(element);
    setMaximum(maximum);
    onResize(Math.round(Math.max(240, Math.min(maximum, next))));
  };
  return (
    <div
      ref={elementRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      aria-valuemin={240}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={width ? `${width} pixels` : "Automatic width"}
      title="Drag to resize. Double-click to reset."
      className={`absolute inset-y-0 z-30 hidden w-2 cursor-col-resize touch-none hover:bg-border/60 focus-visible:bg-border focus-visible:outline-none ${breakpoint === "xl" ? "xl:block" : "md:block"} ${side === "right" ? "right-0" : "left-0"}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        start.current = {
          x: event.clientX,
          width: event.currentTarget.parentElement!.getBoundingClientRect().width,
          original: width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current)
          adjust(
            event.currentTarget,
            start.current.width + (event.clientX - start.current.x) * (side === "right" ? 1 : -1),
          );
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        if (start.current) onResize(start.current.original);
        start.current = null;
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onDoubleClick={() => onResize()}
      onKeyDown={(event) => {
        if (event.key === "Home") {
          event.preventDefault();
          onResize();
          return;
        }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        adjust(
          event.currentTarget,
          event.currentTarget.parentElement!.getBoundingClientRect().width +
            (event.key === "ArrowRight" ? 32 : -32) * (side === "right" ? 1 : -1),
        );
      }}
    />
  );
}
