import { useRef, useState, type PointerEvent } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { columnLabel } from "./facets.ts";
import { columnSizingBounds } from "./column-sizing.ts";

/** A separate resize target: pointer preview, keyboard sizing and reset. */
export function DataTableColumnResize<T>({
  column,
  table,
  width,
}: {
  column: Column<T, unknown>;
  table: Table<T>;
  width: number;
}) {
  const drag = useRef<{ x: number; width: number; direction: number; pointerId: number } | null>(
    null,
  );
  const [delta, setDelta] = useState<number | null>(null);
  const { minimum, maximum } = columnSizingBounds(column);
  const clamp = (value: number) => Math.max(minimum, Math.min(maximum, Math.round(value)));
  const size = (element: HTMLElement) =>
    element.closest("th")?.getBoundingClientRect().width || width;
  const commit = (value: number) =>
    table.setColumnSizing((current) => ({
      ...current,
      [column.id]: clamp(value),
    }));
  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const start = drag.current;
    if (!start) return;
    if (!cancelled) commit(start.width + (event.clientX - start.x) * start.direction);
    drag.current = null;
    setDelta(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${columnLabel(column)} column`}
      aria-valuenow={Math.round(width)}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      title="Drag to resize. Arrow keys adjust width; Enter or double-click resets."
      data-column-resize=""
      data-resizing={delta !== null ? "" : undefined}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        column.resetSize();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
        drag.current = {
          x: event.clientX,
          width: size(event.currentTarget),
          direction,
          pointerId: event.pointerId,
        };
        setDelta(0);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const start = drag.current;
        const change =
          clamp(start.width + (event.clientX - start.x) * start.direction) - start.width;
        setDelta(change * start.direction);
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={() => {
        drag.current = null;
        setDelta(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && drag.current) {
          event.preventDefault();
          event.stopPropagation();
          const pointerId = drag.current.pointerId;
          drag.current = null;
          setDelta(null);
          if (event.currentTarget.hasPointerCapture(pointerId))
            event.currentTarget.releasePointerCapture(pointerId);
          return;
        }
        if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Enter") column.resetSize();
        else if (event.key === "Home") commit(minimum);
        else if (event.key === "End") commit(maximum);
        else {
          const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          commit(
            size(event.currentTarget) +
              (event.key === "ArrowRight" ? 1 : -1) * direction * (event.shiftKey ? 50 : 10),
          );
        }
      }}
    >
      <span
        aria-hidden
        style={delta === null ? undefined : { transform: `translateX(${delta}px)` }}
      />
    </button>
  );
}
