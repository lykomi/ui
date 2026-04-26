import { type ReactNode, useEffect } from "react";
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
  ContextPins,
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
  const { pathname } = useLocation();
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
    setCurrentPage(pathname);
    const found = findNavItem(navConfig, pathname);
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
  }, [pathname, navConfig, setCurrentPage, setNavContext]);

  // Page content (Outlet) — always rendered to keep page tools and context alive.
  const page = <Outlet />;

  // Aggregate module layoutExtras into a single fragment.
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />

          {isExpanded ? (
            <ToolPanelLayout>
              <div className="flex h-full min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <ChatHeader />
                  <ChatContent />
                </div>

                {showPagePanel && (
                  <div
                    className={cn(
                      "hidden h-full shrink-0 border-l border-border bg-background xl:flex xl:flex-col",
                    )}
                    style={{ width: 600 }}
                  >
                    <PagePanelActions />
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{page}</div>
                  </div>
                )}
              </div>
            </ToolPanelLayout>
          ) : (
            <ToolPanelLayout>
              <div className="flex flex-1 flex-col overflow-hidden">
                <ChatHeader />
                {page}
              </div>
            </ToolPanelLayout>
          )}
        </div>

        <ChatBubble />
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
        <ContextPins compact flyoutDirection="down" />
        <TooltipIconButton tooltip="Close panel" size="icon" onClick={togglePagePanel}>
          <X className="size-4" />
        </TooltipIconButton>
      </div>
    </div>
  );
}
