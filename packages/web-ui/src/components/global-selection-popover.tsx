/**
 * Global "Add to context" popover for text selection anywhere on the page.
 *
 * Appears near selected text when the user makes a selection outside of
 * input elements and the tool panel (which has its own SelectionPopover).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { TextSelect } from "lucide-react";
import { cn } from "@lastspace/web-primitives";
import { useAppStore } from "../lib/app-store.ts";

const POPOVER_HEIGHT = 36;
const POPOVER_WIDTH = 150;
const OFFSET = 8;

/** Elements where selection should NOT trigger the popover */
function isEditableTarget(node: Node): boolean {
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function GlobalSelectionPopover() {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const addContextItem = useAppStore((s) => s.addContextItem);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hidePopover = useCallback(() => {
    setPosition(null);
    setSelectedText("");
  }, []);

  const handleMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      // Skip if inside editable element
      if (isEditableTarget(anchorNode)) return;

      // Skip if inside tool panel (it has its own SelectionPopover)
      const el = anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
      if (el?.closest("[data-tool-panel]")) return;

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position above selection, fixed to viewport
      let top = rect.top - POPOVER_HEIGHT - OFFSET;
      let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;

      // If would go above viewport, place below
      if (top < OFFSET) {
        top = rect.bottom + OFFSET;
      }

      // Clamp horizontal
      left = Math.max(OFFSET, Math.min(left, window.innerWidth - POPOVER_WIDTH - OFFSET));

      setSelectedText(text);
      setPosition({ top, left });
    });
  }, []);

  const handleAddToContext = useCallback(() => {
    if (!selectedText) return;

    const navLabel = useAppStore.getState().navContext.label;

    addContextItem({
      type: "selection",
      label: selectedText,
      payload: { kind: "text", text: selectedText },
      sourcePage: navLabel,
      persistence: "ephemeral",
    });

    window.getSelection()?.removeAllRanges();
    hidePopover();
  }, [selectedText, addContextItem, hidePopover]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      hidePopover();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hidePopover();
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseUp, hidePopover]);

  if (!position) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        "fixed z-50",
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
      Add to context
    </button>
  );
}
