import { useRef } from "react";
import { useChatWidth } from "./use-chat-width.ts";
export function ChatResizeHandle({ chatWidth }: { chatWidth: ReturnType<typeof useChatWidth> }) {
  const resizeDrag = useRef<{ x: number; width: number } | null>(null);
  return (
    <div
      role="separator"
      data-panel-resize
      aria-label="Resize chat"
      aria-orientation="vertical"
      aria-valuemin={chatWidth.min}
      aria-valuemax={chatWidth.max}
      aria-valuenow={chatWidth.width}
      tabIndex={0}
      title="Drag to resize chat. Double-click to reset."
      className="absolute inset-y-0 z-40 w-2 cursor-col-resize touch-none hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
      style={{ right: -4 }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.closest("[data-workbench-surface]")?.setAttribute("data-resizing", "");
        resizeDrag.current = { x: event.clientX, width: chatWidth.width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (resizeDrag.current)
          chatWidth.setWidth(resizeDrag.current.width + event.clientX - resizeDrag.current.x);
      }}
      onPointerUp={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
      }}
      onLostPointerCapture={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
      }}
      onDoubleClick={() => chatWidth.setWidth(null)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 16;
        if (event.key === "ArrowLeft") chatWidth.setWidth(chatWidth.width - step);
        else if (event.key === "ArrowRight") chatWidth.setWidth(chatWidth.width + step);
        else if (event.key === "Home") chatWidth.setWidth(chatWidth.min);
        else if (event.key === "End") chatWidth.setWidth(chatWidth.max);
        else return;
        event.preventDefault();
      }}
    />
  );
}
