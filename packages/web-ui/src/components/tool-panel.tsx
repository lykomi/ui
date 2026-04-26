import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { X, Maximize2, Minimize2, Copy, Check, Pin, PinOff, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@iloveagents/foundry-web-primitives";
import { useToolPanelStore, type ToolPanelContent } from "../lib/tool-panel-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./markdown-text.tsx";
import { SelectionPopover } from "./selection-popover.tsx";

/** Renders panel content using the renderer registry, then built-in markdown/text. */
function PanelContentRenderer({ content }: { content: ToolPanelContent }) {
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

export function ToolPanel() {
  const isOpen = useToolPanelStore((state) => state.isOpen);
  const content = useToolPanelStore((state) => state.content);
  const closePanel = useToolPanelStore((state) => state.closePanel);
  const panelWidth = useToolPanelStore((state) => state.panelWidth);
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
    if (!entityId) return;
    navigate(`/spaces/${entityId}`);
    closePanel();
  }, [entityId, navigate, closePanel]);

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
      if (e.key === "Escape" && isOpen) {
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
        "fixed top-0 right-0 z-40",
        "h-dvh",
        "bg-background border-l border-border shadow-2xl",
        "transition-transform duration-300 ease-in-out",
        "flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
      style={{ width: panelWidth }}
    >
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
                    isEntityPinned && "text-primary",
                  )}
                  aria-label={isEntityPinned ? "Unpin document" : "Pin document"}
                  title={isEntityPinned ? "Unpin document" : "Pin document"}
                >
                  {isEntityPinned ? (
                    <PinOff className="size-4" />
                  ) : (
                    <Pin className="size-4 text-muted-foreground" />
                  )}
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
