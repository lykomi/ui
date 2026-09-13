import { PinStateIcon } from "./pin-state-icon.tsx";
/**
 * Context Pins — pin button with count badge and hover flyout.
 *
 * Click: toggles pin/unpin current page.
 * Hover (when pins exist): shows flyout to view, navigate, and remove pins.
 */

import { type FC, useState, useRef, useEffect, createElement } from "react";
import { useNavigate } from "react-router";
import { X, TextSelect, FileText, Link2, StickyNote, type LucideIcon } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { useAppStore, type ContextItem, type ContextItemType } from "../lib/app-store.ts";

const CONTEXT_ICONS: Record<ContextItemType, LucideIcon> = {
  selection: TextSelect,
  page: FileText,
  ref: Link2,
  note: StickyNote,
};

interface ContextPinsProps {
  allowPageToggle?: boolean;
  /** Show the pin button to add current page */
  showPinButton?: boolean;
  /** Compact mode for small containers (mini chat bubble header) */
  compact?: boolean;
  /** Direction flyout opens: up (composer) or down (header) */
  flyoutDirection?: "up" | "down";
}

/** Resolve the URL a context item navigates to when clicked.
 *
 * Two shapes the framework knows about:
 *
 * 1. **Page** (``type: "page"``) — the canonical case the OSS shell
 *    creates for "Pin this page". The payload's ``path`` IS the
 *    navigation target.
 * 2. **Ref** (``type: "ref"``) — created by feature modules when the
 *    user pins a structured reference (Spaces blocks, code symbols,
 *    DB rows, …). The framework stays agnostic about the ref shape;
 *    the source module places the canonical deep-link URL — including
 *    any anchor hash — in the chip's ``sourcePage`` field, which is
 *    already the conventional "where the user pinned from" breadcrumb.
 *    Surfacing it here makes every feature module's ref chips clickable
 *    without an extension-point registry, and without the framework
 *    knowing module-specific URL shapes.
 *
 * Other item types (``selection``, ``note``) intentionally stay
 * non-clickable — they are excerpts / annotations, not anchors.
 *
 * @internal Exported for unit tests; not part of the public API.
 */
export function getNavigablePath(item: ContextItem): string | null {
  if (item.type === "page" && item.payload.kind === "page") return item.payload.path;
  if (
    item.type === "ref" &&
    item.payload.kind === "ref" &&
    typeof item.sourcePage === "string" &&
    // Guard: ``sourcePage`` is also used as a free-form breadcrumb
    // label by some callers (e.g. "page-label" instead of "/page").
    // Treat it as a navigation target only when it looks like an
    // in-app path. Hash-only links (``#anchor``) are also valid —
    // they keep the user on the current entity but scroll to the
    // pinned atom (e.g. Spaces ``#block-{id}`` deep-link from the
    // current page).
    (item.sourcePage.startsWith("/") || item.sourcePage.startsWith("#"))
  ) {
    return item.sourcePage;
  }
  return null;
}

/**
 * The "is this page pinned, and how do I flip that" logic, shared by the
 * pin badge here and the composer's add-menu. Two call sites deciding
 * independently what "pinned" means is how they end up disagreeing.
 */
export function usePagePin() {
  const items = useAppStore((s) => s.contextItems);
  const removeItem = useAppStore((s) => s.removeContextItem);
  const addContextItem = useAppStore((s) => s.addContextItem);
  const currentPage = useAppStore((s) => s.currentPage);
  const pageLabel = useAppStore((s) => s.navContext.label);
  const navMeta = useAppStore((s) => s.navContext.meta);

  const currentPagePin = items.find(
    (i) =>
      i.persistence === "persistent" &&
      i.type === "page" &&
      i.payload.kind === "page" &&
      i.payload.path === currentPage,
  );

  return {
    isPinned: !!currentPagePin,
    toggle: () => {
      if (currentPagePin) {
        removeItem(currentPagePin.id);
        return;
      }
      addContextItem({
        type: "page",
        label: pageLabel,
        payload: { kind: "page", path: currentPage, label: pageLabel, meta: navMeta },
        sourcePage: currentPage,
        persistence: "persistent",
      });
    },
  };
}

export const ContextPins: FC<ContextPinsProps> = ({
  allowPageToggle = true,
  showPinButton = false,
  compact = false,
  flyoutDirection = "up",
}) => {
  const items = useAppStore((s) => s.contextItems);
  const removeItem = useAppStore((s) => s.removeContextItem);
  const currentPage = useAppStore((s) => s.currentPage);
  const { isPinned: isCurrentPagePinned, toggle: handleTogglePin } = usePagePin();
  const navigate = useNavigate();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pinned = items.filter((i) => i.persistence === "persistent");

  // Close flyout on outside click
  useEffect(() => {
    if (!flyoutOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [flyoutOpen]);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    if (pinned.length > 0) setFlyoutOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setFlyoutOpen(false), 200);
  };

  if (pinned.length === 0 && !showPinButton) return null;

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipIconButton
        tooltip={
          allowPageToggle
            ? isCurrentPagePinned
              ? "Unpin this page"
              : "Pin this page"
            : "Manage pinned context"
        }
        size="icon"
        className={cn(
          "shrink-0 relative",
          compact ? "size-7" : "size-8",
          isCurrentPagePinned ? "text-foreground" : "text-muted-foreground",
        )}
        aria-pressed={allowPageToggle ? isCurrentPagePinned : undefined}
        onClick={allowPageToggle ? handleTogglePin : () => setFlyoutOpen((open) => !open)}
      >
        <PinStateIcon pinned={isCurrentPagePinned} className={compact ? "size-3.5" : "size-4"} />
        {pinned.length > 0 && (
          <span
            className={cn(
              "absolute rounded-full bg-primary font-medium text-primary-foreground flex items-center justify-center",
              compact
                ? "-top-0.5 -right-0.5 size-3.5 text-[9px]"
                : "top-0 right-0 size-3.5 text-[9px]",
            )}
          >
            {pinned.length}
          </span>
        )}
      </TooltipIconButton>

      {/* Hover flyout */}
      {flyoutOpen && pinned.length > 0 && (
        <div
          className={cn(
            "absolute z-50 w-64 rounded-lg border border-border bg-background shadow-xl p-2 space-y-1",
            flyoutDirection === "up" ? "bottom-full mb-2 left-0" : "top-9 right-0",
          )}
        >
          <div className="px-1 pb-1 border-b border-border/50">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Pinned Context
            </span>
          </div>
          {pinned.map((item) => {
            const navPath = getNavigablePath(item);
            return (
              <div
                key={item.id}
                className="flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted group/pin"
              >
                {createElement(CONTEXT_ICONS[item.type] ?? TextSelect, {
                  className: "size-3 text-primary shrink-0",
                })}
                {navPath ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(navPath);
                      setFlyoutOpen(false);
                    }}
                    className="text-xs text-foreground truncate flex-1 text-left hover:underline"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="text-xs text-foreground truncate flex-1">{item.label}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className={cn(
                    "p-0.5 rounded hover:bg-primary/10 transition-opacity shrink-0",
                    "opacity-0 group-hover/pin:opacity-100",
                  )}
                  aria-label={`Remove ${item.label}`}
                >
                  <X className="size-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
