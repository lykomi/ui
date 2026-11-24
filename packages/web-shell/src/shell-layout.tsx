import { type ReactNode, lazy, Suspense, useEffect, useRef } from "react";
import { matchPath, Outlet, useLocation } from "react-router";
import {
  ThemeDocumentMetadata,
  ChatLeaveGuard,
  TeachingBubbleHost,
  ThemeRuntimeProvider,
  ThemeScope,
  GlobalSelectionPopover,
  useAppStore,
  useNavStore,
  findNavItem,
  useThemeStore,
  type ThemeLayer,
} from "@lykomi/web-ui";
import type { ChatModule } from "./types.ts";
const WorkbenchPreview = lazy(() =>
  import("@lykomi/web-ui/workbench").then((module) => ({
    default: module.WorkbenchPreview,
  })),
);

interface ShellLayoutProps {
  modules: ChatModule[];
  defaultSideChatCollapsed?: boolean;
  baseThemeLayers: ThemeLayer[];
  chatRoutes: string[];
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
export function ShellLayout({
  modules,
  baseThemeLayers,
  chatRoutes,
  defaultSideChatCollapsed,
}: ShellLayoutProps) {
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
  const isChatRoute =
    pathname === "/" ||
    chatRoutes.some((path) =>
      matchPath({ path: path.startsWith("/") ? path : `/${path}`, end: true }, pathname),
    ) ||
    modules.some((m) => {
      const pattern = m.chatConversation?.pathPattern;
      if (!pattern) return false;
      return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).test(pathname);
    });

  // Sync route + navigation context to app store.
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navConfig = useNavStore((s) => s.config);

  const previousContextPage = useRef<string | null>(null);
  const previousContextConfig = useRef<typeof navConfig | null>(null);
  useEffect(() => {
    const found = findNavItem(navConfig, pathname + search);
    const target = found?.item.to;
    const scope = target ? new URL(target, "http://navigation.local").search : "";
    const page = pathname + scope;
    if (previousContextPage.current === page && previousContextConfig.current === navConfig) return;
    previousContextConfig.current = navConfig;
    previousContextPage.current = page;
    setCurrentPage(page);
    const mergedInstructions = [found?.groupInstructions, found?.item.contextInstructions]
      .filter(Boolean)
      .join("\n");

    setNavContext({
      group: found?.group ?? null,
      groupDescription: found?.groupDescription ?? null,
      groupMeta: found?.groupMeta ?? {},
      label: found?.item.label ?? (pathname === "/" ? "Home" : pathname),
      description: found?.item.description ?? null,
      meta: found?.item.meta ?? {},
      contextInstructions: mergedInstructions || null,
    });
  }, [pathname, search, navConfig, setCurrentPage, setNavContext]);

  // Routed chat pages supply their own ChatContent and any page-specific hooks.
  // Other pages stay mounted in the content pane while chat opens and closes.
  const page = <Outlet />;

  const layoutExtras: ReactNode[] = [];
  for (const m of modules) {
    if (m.layoutExtras) {
      layoutExtras.push(<ModuleExtra key={m.name}>{m.layoutExtras}</ModuleExtra>);
    }
  }

  return (
    <ThemeRuntimeProvider layers={themeLayers} mode={themeMode}>
      <ThemeScope className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <ChatLeaveGuard />
        <ThemeDocumentMetadata />
        {layoutExtras}
        <Suspense fallback={null}>
          <WorkbenchPreview
            page={isChatRoute ? null : page}
            chatPage={isChatRoute ? page : undefined}
            chatOnly={isChatRoute}
            defaultSideChatCollapsed={defaultSideChatCollapsed}
          />
        </Suspense>
        <GlobalSelectionPopover />
        <TeachingBubbleHost />
      </ThemeScope>
    </ThemeRuntimeProvider>
  );
}

function ModuleExtra({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
