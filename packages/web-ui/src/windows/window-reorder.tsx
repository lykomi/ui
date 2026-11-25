import { useEffect, useRef } from "react";
import type { PointerEvent, MouseEvent } from "react";
import type { WindowController } from "./window-controller.ts";

/** Drag commits once on release; moving a window never remounts its editor. */
export function useWindowReorder(id: string, controller: Pick<WindowController, "move" | "get">) {
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    target: number | null;
    marker: Element | null;
  } | null>(null);
  const suppressClick = useRef(false);
  useEffect(
    () => () => {
      drag.current?.marker?.removeAttribute("data-window-drop");
    },
    [],
  );
  const finish = (commit: boolean) => {
    const current = drag.current;
    current?.marker?.removeAttribute("data-window-drop");
    if (commit && current?.moved && current.target !== null && current.target >= 0)
      controller.move(id, current.target);
    suppressClick.current = Boolean(current?.moved);
    drag.current = null;
  };
  return {
    "data-window-reorder": "",
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      suppressClick.current = false;
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: null,
        marker: null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = drag.current;
      if (!current) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6 && !current.moved)
        return;
      current.moved = true;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-reorder-tab],[data-item-tab]");
      if (
        target?.closest("[data-window-workbench]") !==
        event.currentTarget.closest("[data-window-workbench]")
      )
        return;
      const targetId =
        target?.getAttribute("data-reorder-tab") ?? target?.getAttribute("data-item-tab");
      current.marker?.removeAttribute("data-window-drop");
      current.marker = target ?? null;
      current.target = targetId
        ? controller.get().tabs.findIndex((tab) => tab.id === targetId)
        : null;
      if (current.target !== null && current.target >= 0)
        target?.setAttribute("data-window-drop", "");
    },
    onPointerUp() {
      finish(true);
    },
    onPointerCancel() {
      finish(false);
    },
    onLostPointerCapture() {
      if (drag.current) finish(false);
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  };
}

export function ReorderTabButton({
  windowId,
  controller,
  onPointerDown,
  onPointerMove,
  ...props
}: import("react").ComponentProps<"button"> & {
  windowId: string;
  controller: Pick<WindowController, "move" | "get">;
}) {
  const drag = useWindowReorder(windowId, controller);
  return (
    <button
      {...props}
      {...drag}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) drag.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented) drag.onPointerMove(event);
      }}
      style={{ ...props.style, touchAction: "none" }}
    />
  );
}
