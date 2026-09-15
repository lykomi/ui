import { useLocation } from "react-router";
import { useAppStore, type ContextItem } from "../lib/app-store.ts";

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
 * Pin the current navigation context from the With menu.
 */
export function usePagePin() {
  const { pathname, search } = useLocation();
  const items = useAppStore((s) => s.contextItems);
  const removeItem = useAppStore((s) => s.removeContextItem);
  const addContextItem = useAppStore((s) => s.addContextItem);
  const page = useAppStore((s) => s.currentPage);
  const currentPage = page === pathname ? page + search : page;
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
