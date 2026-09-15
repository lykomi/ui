import { type ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import {
  Sidebar,
  ToolPanelLayout,
  ChatHeader,
  ChatBubble,
  ThemeDocumentMetadata,
  ThemeRuntimeProvider,
  ThemeScope,
  GlobalSelectionPopover,
  ChatContent,
  TooltipIconButton,
  useAppStore,
  useNavStore,
  findNavItem,
  useChatBubbleStore,
  useThemeStore,
  type ThemeLayer,
} from "@iloveagents/foundry-web-ui";
import { cn } from "@iloveagents/foundry-web-primitives";
import { X } from "lucide-react";
import type { ChatModule } from "./types.ts";
import { usePagePanelWidth, MIN_PAGE_PANEL_WIDTH } from "./use-page-panel-width.ts";
import { isWorkbenchPreviewEnabled } from "./runtime-config.ts";
const WorkbenchPreview = lazy(() =>
  import("@iloveagents/foundry-web-ui/workbench").then((module) => ({
    default: module.WorkbenchPreview,
  })),
);

interface ShellLayoutProps {
  modules: ChatModule[];
  baseThemeLayers: ThemeLayer[];
}

/**
 * Generic app layout — rendered as the outlet for the customer's routes.
 *
 * Each module contributes:
 * - `useInit`: hook body run here so React's rules-of-hooks apply.
 * - `useThemeLayers`: theme layers stacked above `baseThemeLayers`.
 * - `layoutExtras`: rendered as a sibling group inside <ThemeScope>.
 *
 * The shell knows nothing about Spaces — `useSpacesInit`, dialogs, banners
 * all flow through the module protocol.
 */
export function ShellLayout({ modules, baseThemeLayers }: ShellLayoutProps) {
  // Module init hooks — called in registration order. Rules-of-hooks
  // require a stable count, so module additions/removals across renders
  // are forbidden (ChatModule[] is meant to be a static prop).
  for (const m of modules) {
    m.useInit?.();
  }

  // Module theme-layer hooks — flatten and merge above the static base.
  const moduleLayers: ThemeLayer[] = [];
  for (const m of modules) {
    if (m.useThemeLayers) {
      for (const layer of m.useThemeLayers()) {
        moduleLayers.push(layer);
      }
    }
  }
  const themeLayers = [...baseThemeLayers, ...moduleLayers];

  const themeMode = useThemeStore((s) => s.mode);
  const { pathname, search } = useLocation();
  const [preview] = useState(isWorkbenchPreviewEnabled);
  const isChatRoute =
    pathname === "/" ||
    modules.some((m) => {
      const pattern = m.chatConversation?.pathPattern;
      if (!pattern) return false;
      return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).test(pathname);
    });
  const isExpanded = useChatBubbleStore((s) => s.isExpanded);
  const showPagePanel = useChatBubbleStore((s) => s.showPagePanel);

  // Collapse expanded chat when navigating to root (already full-screen there).
  useEffect(() => {
    if (pathname === "/" && isExpanded) {
      useChatBubbleStore.getState().close();
    }
  }, [pathname, isExpanded]);

  // Sync route + navigation context to app store.
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navConfig = useNavStore((s) => s.config);

  useEffect(() => {
    const found = findNavItem(navConfig, pathname + search);
    setCurrentPage(found?.item.to ?? pathname);
    const mergedInstructions = [found?.groupInstructions, found?.item.contextInstructions]
      .filter(Boolean)
      .join("\n");

    setNavContext({
      group: found?.group ?? null,
      groupDescription: found?.groupDescription ?? null,
      groupMeta: found?.groupMeta ?? {},
      label: found?.item.label ?? pathname,
      description: found?.item.description ?? null,
      meta: found?.item.meta ?? {},
      contextInstructions: mergedInstructions || null,
    });
  }, [pathname, search, navConfig, setCurrentPage, setNavContext]);

  // Page content (Outlet) — always rendered to keep page tools and context alive.
  const page = <Outlet />;

  // Aggregate module layoutExtras into a single fragment.
  const {
    width: pagePanelWidth,
    setWidth: setPagePanelWidth,
    nudgeWidth: nudgePagePanelWidth,
    startDrag: startPagePanelDrag,
    maxWidth: pagePanelMaxWidth,
  } = usePagePanelWidth();

  const layoutExtras: ReactNode[] = [];
  for (const m of modules) {
    if (m.layoutExtras) {
      layoutExtras.push(<ModuleExtra key={m.name}>{m.layoutExtras}</ModuleExtra>);
    }
  }

  return (
    <ThemeRuntimeProvider layers={themeLayers} mode={themeMode}>
      <ThemeScope className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <ThemeDocumentMetadata />
        {layoutExtras}
        {preview ? (
          <Suspense fallback={null}>
            <WorkbenchPreview page={isChatRoute ? null : page} chatOnly={isChatRoute} />
          </Suspense>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <Sidebar newConversationLabel={preview ? "New chat" : undefined} />

            {/*
            ONE tree, ONE slot for ``page`` — never two branches.

            Expanding the chat used to swap between two different JSX
            trees, each rendering ``{page}`` at a different position. React
            cannot reconcile across that: it unmounted the whole page
            subtree and mounted a fresh one on every expand/collapse. Pages
            holding live sessions lost them — the embedded Office editor
            tore down its WOPI session and the user's text selection
            vanished on every chat interaction.

            Now the page column is always rendered at a fixed slot and only
            its CLASSES change. The conditional siblings collapse to
            ``false`` in fixed JSX slots, so the page's fiber position is
            stable and its state survives every layout change.
          */}
            <ToolPanelLayout>
              <div
                className={cn(
                  "flex min-h-0 flex-1 overflow-hidden",
                  isExpanded ? "h-full min-w-0" : "flex-col",
                )}
              >
                {isExpanded && (
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <ChatHeader />
                    <ChatContent />
                  </div>
                )}

                {isExpanded && showPagePanel && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize content panel"
                    aria-valuemin={MIN_PAGE_PANEL_WIDTH}
                    aria-valuemax={pagePanelMaxWidth}
                    aria-valuenow={Math.round(pagePanelWidth)}
                    tabIndex={0}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      startPagePanelDrag(event.pointerId);
                    }}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 80 : 24;
                      if (event.key === "ArrowLeft") nudgePagePanelWidth(step);
                      else if (event.key === "ArrowRight") nudgePagePanelWidth(-step);
                      else if (event.key === "Home") setPagePanelWidth(pagePanelMaxWidth);
                      else if (event.key === "End") setPagePanelWidth(MIN_PAGE_PANEL_WIDTH);
                      else return;
                      event.preventDefault();
                    }}
                    className={cn(
                      "hidden w-1.5 shrink-0 cursor-col-resize touch-none min-[780px]:block",
                      "bg-transparent hover:bg-primary/30 focus-visible:bg-primary",
                      "focus:outline-none",
                    )}
                  />
                )}

                {!isExpanded && <ChatHeader />}

                {/* The page column: ALWAYS this slot, ALWAYS this wrapper. */}
                <div
                  className={cn(
                    isExpanded
                      ? cn(
                          "h-full shrink-0 border-l border-border bg-background",
                          // 780px === SIDE_BY_SIDE_BREAKPOINT_PX, which a
                          // test pins to MIN_PAGE_PANEL_WIDTH + MIN_CHAT_WIDTH.
                          // The literal cannot be interpolated — Tailwind only
                          // sees static class strings — so the two are tied by
                          // that test rather than by the compiler.
                          // 780px = MIN_PAGE_PANEL_WIDTH + MIN_CHAT_WIDTH, the
                          // narrowest viewport where both columns fit. This was
                          // `xl` (1280px), which hid the document on every
                          // window between the two — expanding the chat beside
                          // an open editor made the editor disappear.
                          "min-[780px]:flex min-[780px]:flex-col",
                          // Genuinely too narrow (or panel off): chat owns the
                          // width and the page stays mounted, just hidden.
                          showPagePanel ? "hidden" : "hidden min-[780px]:hidden",
                        )
                      : "flex min-h-0 flex-1 flex-col overflow-hidden",
                  )}
                  style={isExpanded && showPagePanel ? { width: pagePanelWidth } : undefined}
                >
                  {isExpanded && showPagePanel && <PagePanelActions />}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{page}</div>
                </div>
              </div>
            </ToolPanelLayout>
          </div>
        )}

        {!preview && <ChatBubble />}
        <GlobalSelectionPopover />
      </ThemeScope>
    </ThemeRuntimeProvider>
  );
}

function ModuleExtra({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function PagePanelActions() {
  const togglePagePanel = useChatBubbleStore((s) => s.togglePagePanel);

  return (
    <div className="shrink-0 flex items-center justify-end px-4 py-3 border-b border-border">
      <div className="flex items-center gap-0.5">
        <TooltipIconButton tooltip="Close panel" size="icon" onClick={togglePagePanel}>
          <X className="size-4" />
        </TooltipIconButton>
      </div>
    </div>
  );
}
