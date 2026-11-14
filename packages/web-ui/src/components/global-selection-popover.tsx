/**
 * Global selection command bar for text selection anywhere on the page.
 *
 * Appears near selected text when the user makes a selection outside of
 * input elements and the tool panel (which has its own SelectionPopover).
 */

import { type FormEvent, useState, useEffect, useCallback, useRef } from "react";
import { PencilLine, Send, TextSelect, X } from "lucide-react";
import { cn } from "@lykomi/web-primitives";
import { useAppStore } from "../lib/app-store.ts";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { submitComposerText } from "../lib/composer-submit-store.ts";
import { resolveSelectionContext, type SelectionContextResult } from "../lib/selection-context.ts";

const ACTION_POPOVER_HEIGHT = 38;
const SIMPLE_POPOVER_WIDTH = 126;
const ACTION_POPOVER_WIDTH = 236;
const MODIFY_POPOVER_WIDTH = 340;
const OFFSET = 8;
const DEFAULT_MODIFY_PROMPT_PREFIX = "Modify the selected content:";

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
  const [selectionContext, setSelectionContext] = useState<SelectionContextResult | null>(null);
  const [mode, setMode] = useState<"actions" | "modify">("actions");
  const [modifyPrompt, setModifyPrompt] = useState("");
  const addContextItem = useAppStore((s) => s.addContextItem);
  const popoverRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setPopoverNode = useCallback((node: HTMLElement | null) => {
    popoverRef.current = node;
  }, []);

  const hidePopover = useCallback(() => {
    setPosition(null);
    setSelectedText("");
    setSelectionContext(null);
    setMode("actions");
    setModifyPrompt("");
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (popoverRef.current?.contains(event.target as Node)) return;

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
      const sourcePage = useAppStore.getState().navContext.label;
      const resolved = resolveSelectionContext({
        text,
        anchorNode,
        focusNode: selection.focusNode,
        range,
        sourcePage,
      });
      const width = resolved.supportsModify ? ACTION_POPOVER_WIDTH : SIMPLE_POPOVER_WIDTH;

      // Position above selection, fixed to viewport
      let top = rect.top - ACTION_POPOVER_HEIGHT - OFFSET;
      let left = rect.left + rect.width / 2 - width / 2;

      // If would go above viewport, place below
      if (top < OFFSET) {
        top = rect.bottom + OFFSET;
      }

      // Clamp horizontal
      left = Math.max(OFFSET, Math.min(left, window.innerWidth - width - OFFSET));

      setSelectedText(text);
      setSelectionContext(resolved);
      setMode("actions");
      setModifyPrompt("");
      setPosition({ top, left });
    });
  }, []);

  const addResolvedContext = useCallback(() => {
    if (!selectionContext) return false;
    addContextItem(selectionContext.item);
    return true;
  }, [addContextItem, selectionContext]);

  const handleAddToContext = useCallback(() => {
    if (!selectedText || !addResolvedContext()) return;

    window.getSelection()?.removeAllRanges();
    hidePopover();
  }, [selectedText, addResolvedContext, hidePopover]);

  const handleStartModify = useCallback(() => {
    setMode("modify");
    setPosition((current) => {
      if (!current) return current;
      const centeredLeft = current.left - (MODIFY_POPOVER_WIDTH - ACTION_POPOVER_WIDTH) / 2;
      return {
        ...current,
        left: Math.max(
          OFFSET,
          Math.min(centeredLeft, window.innerWidth - MODIFY_POPOVER_WIDTH - OFFSET),
        ),
      };
    });
  }, []);

  const handleModifySubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const prompt = modifyPrompt.trim();
      if (!prompt || !selectionContext || !addResolvedContext()) return;

      const text =
        selectionContext.formatModifyPrompt?.(prompt) ??
        `${DEFAULT_MODIFY_PROMPT_PREFIX} ${prompt}`;
      useChatBubbleStore.getState().open();
      submitComposerText(text);
      window.getSelection()?.removeAllRanges();
      hidePopover();
    },
    [addResolvedContext, hidePopover, modifyPrompt, selectionContext],
  );

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
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

  useEffect(() => {
    if (mode === "modify") {
      inputRef.current?.focus();
    }
  }, [mode]);

  if (!position || !selectionContext) return null;

  if (mode === "modify") {
    return (
      <form
        ref={setPopoverNode}
        className={cn(
          "fixed z-50",
          "flex items-center gap-1.5",
          "rounded-2xl border border-border/70 bg-background/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md",
          "animate-in fade-in-0 zoom-in-95 duration-150",
        )}
        style={{ top: position.top, left: position.left, width: MODIFY_POPOVER_WIDTH }}
        onSubmit={handleModifySubmit}
      >
        <PencilLine className="ml-1 size-3.5 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={modifyPrompt}
          onChange={(event) => setModifyPrompt(event.target.value)}
          placeholder="Describe change..."
          className={cn(
            "min-w-0 flex-1 bg-transparent px-1 py-1.5 text-xs text-foreground outline-none",
            "placeholder:text-muted-foreground",
          )}
        />
        <button
          type="button"
          aria-label="Cancel modify"
          onClick={hidePopover}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
        <button
          type="submit"
          aria-label="Send modify prompt"
          disabled={!modifyPrompt.trim()}
          className={cn(
            "rounded-full p-1.5 transition-colors",
            modifyPrompt.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground opacity-50",
          )}
        >
          <Send className="size-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div
      ref={setPopoverNode}
      role="toolbar"
      aria-label="Selection actions"
      className={cn(
        "fixed z-50",
        "inline-flex items-center gap-1",
        "rounded-full border border-border/70 bg-background/95 p-1 shadow-xl shadow-black/10 backdrop-blur-md",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        onClick={handleAddToContext}
      >
        <TextSelect className="size-3.5 text-primary" />
        Add to chat
      </button>
      {selectionContext.supportsModify && (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          onClick={handleStartModify}
        >
          <PencilLine className="size-3.5 text-primary" />
          Modify
        </button>
      )}
    </div>
  );
}
