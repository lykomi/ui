import { PinStateIcon } from "./pin-state-icon.tsx";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { X, Maximize2, Minimize2, Copy, Check, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  clampPanelWidth,
  MIN_PANEL_WIDTH,
  useToolPanelStore,
  type ToolPanelContent,
} from "../lib/tool-panel-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./markdown-text.tsx";
import { SelectionPopover } from "./selection-popover.tsx";

/** Renders panel content using the renderer registry, then built-in markdown/text. */
export function PanelContentRenderer({ content }: { content: ToolPanelContent }) {
  const renderers = useToolPanelStore((s) => s.renderers);

  // Check registered renderers first (e.g., PDF viewer, entity pages, demo pages)
  const customRenderer = renderers.find((r) => r.match(content));
  if (customRenderer) {
    const Component = customRenderer.component;
    return (
      <Suspense fallback={null}>
        <Component content={content} />
      </Suspense>
    );
  }

  // Built-in markdown / text rendering
  return (
    <div className="px-6 py-4">
      {content.type === "markdown" ? (
        <div className="max-w-2xl mx-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content.content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm text-foreground max-w-2xl mx-auto">
          {content.content}
        </div>
      )}
    </div>
  );
}

export function ToolPanel({ contained = false }: { contained?: boolean }) {
  const isOpen = useToolPanelStore((state) => state.isOpen && !state.isWindowHosted);
  const content = useToolPanelStore((state) =>
    state.isWindowHosted ? state.hostedOwnerContent : state.content,
  );
  const closePanel = useToolPanelStore((state) => state.closePanel);
  const panelWidth = useToolPanelStore((state) => state.panelWidth);
  const setPanelWidth = useToolPanelStore((state) => state.setPanelWidth);
  const useOverlay = useToolPanelStore((state) => state.useOverlay);
  /** Pointer id of an in-flight resize drag (null when idle). */
  const dragPointerId = useRef<number | null>(null);
  const maxPanelWidth =
    typeof window !== "undefined"
      ? clampPanelWidth(Number.POSITIVE_INFINITY, window.innerWidth)
      : MIN_PANEL_WIDTH;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (dragPointerId.current === null) return;
      setPanelWidth(window.innerWidth - event.clientX);
    };
    // pointercancel matters: a cancelled drag must not leave the document
    // unselectable with a col-resize cursor (review catch).
    const onPointerEnd = (event: PointerEvent) => {
      if (dragPointerId.current !== null && event.pointerId !== dragPointerId.current) return;
      dragPointerId.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      // Unmounting mid-drag must not strand the styles either.
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [setPanelWidth]);
  const isFullscreen = useToolPanelStore((state) => state.isFullscreen);
  const toggleFullscreen = useToolPanelStore((state) => state.toggleFullscreen);
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Pin state for SPACES entities
  const entityId = content?.entityId;
  const contextItems = useAppStore((s) => s.contextItems);
  const addContextItem = useAppStore((s) => s.addContextItem);
  const removeContextItem = useAppStore((s) => s.removeContextItem);

  const entityPin = entityId
    ? contextItems.find(
        (i) =>
          i.persistence === "persistent" &&
          i.type === "page" &&
          i.payload.kind === "page" &&
          (i.payload as { path: string }).path === `/spaces/${entityId}`,
      )
    : null;
  const isEntityPinned = !!entityPin;

  const handleToggleEntityPin = useCallback(() => {
    if (!entityId || !content) return;
    if (entityPin) {
      removeContextItem(entityPin.id);
    } else {
      addContextItem({
        type: "page",
        label: content.title,
        payload: { kind: "page", path: `/spaces/${entityId}`, label: content.title, meta: {} },
        sourcePage: `/spaces/${entityId}`,
        persistence: "persistent",
      });
    }
  }, [entityId, entityPin, content, addContextItem, removeContextItem]);

  const handleNavigateToEntity = useCallback(() => {
    if (!entityId || !content) return;
    navigate(content.type === "page" ? content.content : `/spaces/${entityId}`);
    closePanel();
  }, [entityId, content, navigate, closePanel]);

  const handleCopyAll = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        isOpen &&
        !e.defaultPrevented &&
        !(e.target instanceof Element && e.target.closest('[role="dialog"]'))
      ) {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, closePanel]);

  if (!content) return null;

  return (
    <div
      data-tool-panel
      className={cn(
        contained ? "absolute inset-0 z-10 h-full" : "fixed top-0 right-0 z-40 h-dvh",
        "bg-background border-l border-border",
        !contained && "shadow-2xl",
        "transition-transform duration-300 ease-in-out",
        "flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
      style={{ width: contained ? "100%" : panelWidth }}
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      {/* Drag-to-resize the split (side-by-side mode only). Mirrors the
          navigation sidebar's handle: listeners live in an effect, the
          drag ends on pointerup OR pointercancel, and cleanup always
          restores userSelect. Keyboard: arrows nudge, Shift jumps,
          Home/End go to the extremes. */}
      {!contained && isOpen && !useOverlay && !isFullscreen ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={maxPanelWidth}
          aria-valuenow={Math.round(panelWidth)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            dragPointerId.current = event.pointerId;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 80 : 24;
            if (event.key === "ArrowLeft") setPanelWidth(panelWidth + step);
            else if (event.key === "ArrowRight") setPanelWidth(panelWidth - step);
            else if (event.key === "Home") setPanelWidth(maxPanelWidth);
            else if (event.key === "End") setPanelWidth(MIN_PANEL_WIDTH);
            else return;
            event.preventDefault();
          }}
          className={cn(
            "absolute left-0 top-0 z-10 h-full w-2 -translate-x-1/2",
            "cursor-col-resize touch-none",
            "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2",
            "before:bg-transparent hover:before:bg-primary/40 focus-visible:before:bg-primary",
            "focus:outline-none",
          )}
        />
      ) : null}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground truncate pr-4">{content.title}</h2>
          <div className="flex items-center gap-1">
            {entityId && (
              <>
                <button
                  type="button"
                  onClick={handleToggleEntityPin}
                  className={cn(
                    "flex items-center justify-center",
                    "size-8 rounded-md shrink-0",
                    "hover:bg-muted transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isEntityPinned ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-pressed={isEntityPinned}
                  aria-label={isEntityPinned ? "Unpin document" : "Pin document"}
                  title={isEntityPinned ? "Unpin document" : "Pin document"}
                >
                  <PinStateIcon pinned={isEntityPinned} />
                </button>
                <button
                  type="button"
                  onClick={handleNavigateToEntity}
                  className={cn(
                    "flex items-center justify-center",
                    "size-8 rounded-md shrink-0",
                    "hover:bg-muted transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                  aria-label="Open in navigation"
                  title="Open in navigation"
                >
                  <FolderOpen className="size-4 text-muted-foreground" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleCopyAll}
              className={cn(
                "flex items-center justify-center",
                "size-8 rounded-md flex-shrink-0",
                "hover:bg-muted transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
              aria-label="Copy content"
            >
              {copied ? (
                <Check className="size-4 text-success" />
              ) : (
                <Copy className="size-4 text-muted-foreground" />
              )}
            </button>
            {!contained && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className={cn(
                  "flex items-center justify-center",
                  "size-8 rounded-md flex-shrink-0",
                  "hover:bg-muted transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-4 text-muted-foreground" />
                ) : (
                  <Maximize2 className="size-4 text-muted-foreground" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={closePanel}
              className={cn(
                "flex items-center justify-center",
                "size-8 rounded-md flex-shrink-0",
                "hover:bg-muted transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
              aria-label="Close panel"
            >
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="relative flex-1 overflow-y-auto"
        ref={contentRef}
        data-testid="tool-panel-content"
      >
        <PanelContentRenderer content={content} />
        <SelectionPopover containerRef={contentRef} />
      </div>
    </div>
  );
}
