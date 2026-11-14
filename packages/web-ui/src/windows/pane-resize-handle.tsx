import { useRef } from "react";
import { cn } from "@lykomi/web-primitives";

/** Shared panel-edge resizing: pointer capture, cancellation, reset and keyboard controls. */
export function PaneResizeHandle({
  label,
  width,
  min,
  max,
  defaultWidth,
  onResize,
  paneSelector,
  logical = false,
  edge = "end",
  className,
  windowReorder = false,
}: {
  label: string;
  width?: number;
  min: number;
  max: number;
  defaultWidth: number;
  onResize: (width?: number) => void;
  paneSelector?: string;
  logical?: boolean;
  edge?: "start" | "end";
  className?: string;
  windowReorder?: boolean;
}) {
  const start = useRef<{ x: number; width: number; original?: number; sign: number } | null>(null);
  const pane = (handle: HTMLElement) =>
    paneSelector ? handle.closest<HTMLElement>(paneSelector) : handle.parentElement;
  const sign = (element: HTMLElement) =>
    (logical && getComputedStyle(element).direction === "rtl" ? -1 : 1) *
    (edge === "start" ? -1 : 1);
  const resize = (next: number) => onResize(Math.round(Math.max(min, Math.min(max, next))));
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width ?? defaultWidth}
      aria-valuetext={width === undefined ? "Automatic width" : `${Math.round(width)} pixels`}
      title="Drag to resize. Double-click to reset."
      data-window-reorder={windowReorder ? "" : undefined}
      className={cn(
        "absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none hover:bg-border/60 focus-visible:bg-border focus-visible:outline-none",
        className,
      )}
      style={
        logical
          ? edge === "start"
            ? { insetInlineStart: 0 }
            : { insetInlineEnd: 0 }
          : edge === "start"
            ? { left: 0 }
            : { right: 0 }
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const element = pane(event.currentTarget);
        if (!element) return;
        event.preventDefault();
        event.stopPropagation();
        start.current = {
          x: event.clientX,
          width: element.getBoundingClientRect().width,
          original: width,
          sign: sign(element),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current)
          resize(start.current.width + (event.clientX - start.current.x) * start.current.sign);
      }}
      onPointerUp={(event) => {
        start.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
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
        const element = pane(event.currentTarget);
        if (!element) return;
        event.preventDefault();
        resize(
          element.getBoundingClientRect().width +
            (event.key === "ArrowRight" ? 32 : -32) * sign(element),
        );
      }}
    />
  );
}
