/**
 * Floating "Add to chat" button for text selection in the tool panel.
 *
 * Appears near the selected text when the user makes a selection within
 * the panel content area. Clicking adds the selection to the context store.
 */

import { type RefObject, useState, useEffect, useCallback, useRef } from "react";
import { TextSelect } from "lucide-react";
import { cn } from "@lykomi/web-primitives";
import { useAppStore } from "../lib/app-store.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";

interface SelectionPopoverProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

interface PopoverPosition {
  top: number;
  left: number;
}

const POPOVER_HEIGHT = 36;
const POPOVER_WIDTH = 126;
const OFFSET = 8;

export function SelectionPopover({ containerRef }: SelectionPopoverProps) {
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const addContextItem = useAppStore((s) => s.addContextItem);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hidePopover = useCallback(() => {
    setPosition(null);
    setSelectedText("");
  }, []);

  const handleMouseUp = useCallback(() => {
    // Small delay to let the selection finalize
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        return;
      }

      // Ensure selection is within the container
      const container = containerRef.current;
      if (!container) return;

      const anchorNode = selection.anchorNode;
      if (!anchorNode || !container.contains(anchorNode)) {
        return;
      }

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // The tool panel uses CSS transforms (translate-x), which creates
      // a new containing block -- `position: fixed` becomes relative to
      // the nearest transformed ancestor, not the viewport. Convert
      // viewport coords to container-relative coords.
      const containerRect = container.getBoundingClientRect();

      // Position above selection
      let top = rect.top - containerRect.top + container.scrollTop - POPOVER_HEIGHT - OFFSET;
      let left = rect.left - containerRect.left + rect.width / 2 - POPOVER_WIDTH / 2;

      // If would go above visible area, place below instead
      if (rect.top - containerRect.top - POPOVER_HEIGHT - OFFSET < 0) {
        top = rect.bottom - containerRect.top + container.scrollTop + OFFSET;
      }

      // Clamp horizontal within container
      const maxLeft = containerRect.width - POPOVER_WIDTH - OFFSET;
      left = Math.max(OFFSET, Math.min(left, maxLeft));

      setSelectedText(text);
      setPosition({ top, left });
    });
  }, [containerRef]);

  const handleAddToContext = useCallback(() => {
    if (!selectedText) return;

    const source = useToolPanelStore.getState().content?.title ?? "Document";

    addContextItem({
      type: "selection",
      label: selectedText,
      payload: { kind: "text", text: selectedText },
      sourcePage: source,
      persistence: "ephemeral",
    });

    // Clear selection and hide popover
    window.getSelection()?.removeAllRanges();
    hidePopover();
  }, [selectedText, addContextItem, hidePopover]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handleMouseUp);

    // Hide on mousedown (new selection starting), scroll, or Escape.
    // Skip if the mousedown is on the popover button itself -- React's
    // synthetic onMouseDown fires after native listeners, so we can't
    // rely on stopPropagation there.
    const handleMouseDown = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      hidePopover();
    };
    const handleScroll = () => hidePopover();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hidePopover();
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, handleMouseUp, hidePopover]);

  if (!position) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        "absolute z-50",
        "flex items-center gap-1.5",
        "rounded-lg border border-border bg-background shadow-lg",
        "px-3 py-1.5 text-xs font-medium text-foreground",
        "hover:bg-muted transition-colors",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleAddToContext}
    >
      <TextSelect className="size-3.5 text-primary" />
      Add to chat
    </button>
  );
}
