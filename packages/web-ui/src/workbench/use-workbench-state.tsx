import { useLocation, useNavigate } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@lykomi/web-primitives";
import {
  useSidebarStore,
  useChatBubbleStore,
  useToolPanelStore,
  useNewConversation,
  useNavStore,
  useAppStore,
  type NavGroup,
} from "../index.ts";
import { MessagesSquare, Settings, Layers, UserRound } from "lucide-react";
import { useRecentSpaceIds, overviewSpaceGroups } from "./recent-spaces.ts";
import { useChatWidth } from "./use-chat-width.ts";
import { findNavItem } from "../lib/nav-config.ts";
import { useWorkbenchCollapsed } from "./layout-state.tsx";

export function normalizeWorkbenchPath(path: string) {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

function useWorkbenchNavigation() {
  const navGroups = useNavStore((s) => s.config);
  const recentIds = useRecentSpaceIds(navGroups);
  const workspaceGroups = useMemo(() => {
    const workspace = navGroups.find(
      (group) => group.meta?.type === "spaces-workspaces" && group.meta?.exclusiveRootId,
    );
    if (!workspace) return undefined;
    return [workspace];
  }, [navGroups]);
  const focusedGroup = workspaceGroups?.[0];
  const focusedRoot =
    focusedGroup?.items.find((item) => item.to === focusedGroup.focusOn) ?? focusedGroup?.items[0];
  useEffect(() => {
    if (focusedRoot?.childrenUnloaded && !focusedRoot.childrenHidden)
      focusedRoot.onExpandedChange?.(true);
  }, [
    focusedRoot?.to,
    focusedRoot?.childrenUnloaded,
    focusedRoot?.childrenHidden,
    focusedRoot?.onExpandedChange,
  ]);
  const navigationGroups = useMemo(() => {
    if (workspaceGroups) {
      const space = workspaceGroups[0];
      const root = space.items.find((item) => item.to === space.focusOn) ?? space.items[0];
      return [
        {
          ...space,
          label: "Spaces",
          icon: Layers,
          hideLabel: true,
          collapsedRail: undefined,
          priority: 1000,
          items: root
            ? [
                {
                  ...root,
                  ...(["personal_space", "personal-space"].includes(
                    String(root.meta?.spacesContentType),
                  )
                    ? { label: "My space", icon: UserRound }
                    : {}),
                  children: root.childrenHidden ? root.children : undefined,
                  childrenLoading: root.childrenHidden ? root.childrenLoading : false,
                  childrenUnloaded: false,
                  onExpandedChange: root.childrenHidden ? root.onExpandedChange : undefined,
                },
              ]
            : space.items,
        },
        {
          label: "Content",
          tree: true,
          hideLabel: true,
          priority: 800,
          items: root?.childrenHidden ? [] : (root?.children ?? []),
          loading: !root?.childrenHidden && Boolean(root?.childrenLoading),
          meta: { hideInCollapsedRail: true },
        },
      ];
    }
    return [
      ...navGroups
        .filter((group) => !["recent-chats", "pinned-chats"].includes(String(group.meta?.type)))
        .flatMap((group) =>
          group.meta?.type === "spaces-workspaces"
            ? overviewSpaceGroups(group, recentIds)
            : group.meta?.type === "spaces-admin"
              ? {
                  ...group,
                  label: "Administration",
                  icon: Settings,
                  collapsible: true,
                  defaultCollapsed: true,
                }
              : group.meta?.type === "spaces-build"
                ? { ...group, label: "App Studio", hideLabel: true, priority: 1075 }
                : group.label === "Activity"
                  ? { ...group, priority: 1100 }
                  : group,
        ),
    ];
  }, [workspaceGroups, navGroups, recentIds]);
  const staticNavigationGroups = useMemo(
    () =>
      navigationGroups.map((group) => ({
        ...group,
        // The workbench supplies its own Home action. Keep the nav item in
        // the context model without rendering a second link to the same URL.
        items: group.items.filter((item) => item.to !== "/"),
        collapsible: group.meta?.type === "spaces-admin" || group.meta?.type === "recent-spaces",
      })),
    [navigationGroups],
  );
  return { navGroups, workspaceGroups, staticNavigationGroups };
}

export function useWorkbenchState(chatRoute: boolean, defaultSideChatCollapsed = true) {
  const panelOpen = useToolPanelStore((s) => s.isOpen && !s.isWindowHosted);
  const location = useLocation();
  const globalHistory =
    location.pathname === "/" &&
    new URLSearchParams(location.search).get("view") === "chat-history";
  const home = chatRoute && !globalHistory;
  const chatOnly = false;
  const navigate = useNavigate();
  const { navGroups, workspaceGroups, staticNavigationGroups } = useWorkbenchNavigation();
  const routeItem = useMemo(() => {
    const item = findNavItem(navGroups, location.pathname + location.search)?.item;
    return item &&
      normalizeWorkbenchPath(item.to.split("?")[0]) === normalizeWorkbenchPath(location.pathname)
      ? item
      : undefined;
  }, [location.pathname, location.search, navGroups]);
  const navigationLoading = useNavStore((state) => state.navLoading);
  // A global chat route has no page context to resolve.
  const pageContextPending = !chatRoute && navigationLoading && !routeItem;
  const pageLabel = useAppStore((s) => s.navContext.label);
  const entityId = routeItem?.meta?.spacesEntityId;
  const chatWidth = useChatWidth();
  const [desktopCollapsed, setCollapsed] = useWorkbenchCollapsed(defaultSideChatCollapsed);
  const collapsed = !chatWidth.compact && desktopCollapsed;
  const [historyPath, setHistoryPath] = useState<string | null>(null);
  const historyOpen = historyPath === location.pathname;
  const [compactPane, setCompactPane] = useState<"chat" | "content">(chatOnly ? "chat" : "content");
  const [contentCollapsed, setContentCollapsed] = useState(false);
  const contentHidden =
    chatOnly || (chatWidth.compact ? compactPane !== "content" : contentCollapsed);
  const openingNewChat = useRef(false);
  useEffect(() => {
    setContentCollapsed(chatOnly);
    const resumedChat = (chatRoute && location.pathname !== "/") || openingNewChat.current;
    openingNewChat.current = false;
    setCompactPane(chatOnly || resumedChat ? "chat" : "content");
    if (resumedChat) setCollapsed(false);
    // Navigation is an explicit request to see content, including selecting
    // the same address again. Collapsing remains local until the next entry.
  }, [chatOnly, chatRoute, location.key, location.pathname, setCollapsed]);
  const setHistoryOpen = (open: boolean) => setHistoryPath(open ? location.pathname : null);
  const running = useAuiState((s) => s.thread.isRunning);
  const emptyChat = useAuiState(
    (s) => s.thread.messages.length === 0 && !s.thread.isRunning && !s.thread.isLoading,
  );
  const canResumeChat = useAuiState((s) => s.thread.messages.length > 0 || s.thread.isRunning);
  const wasEmptyChat = useRef(emptyChat);
  useEffect(() => {
    if (wasEmptyChat.current && !emptyChat) setHistoryOpen(false);
    wasEmptyChat.current = emptyChat;
  }, [emptyChat]);
  const showHistory = historyOpen;
  const spaciousChat = chatOnly || contentCollapsed;
  const returnToChat = () => {
    setHistoryOpen(false);
  };
  const openHistory = () => {
    setHistoryOpen(true);
  };
  const openGlobalHistory = () => {
    useToolPanelStore.getState().closePanel();
    setHistoryPath(null);
    navigate("/?view=chat-history", { state: { preserveActiveChat: true } });
    setCompactPane("content");
  };
  const historyShortcut = (
    <Button
      variant="ghost"
      size="sm"
      onClick={openHistory}
      className="h-9 w-fit gap-2 px-2 text-sm font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
    >
      <MessagesSquare className="size-4" aria-hidden />
      Chat history
    </Button>
  );
  const toggleNavigation = useSidebarStore((s) => s.toggleMobile);
  useEffect(() => {
    if (panelOpen) {
      setContentCollapsed(false);
      setCompactPane("content");
    }
  }, [panelOpen]);
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const requestedChat = useChatBubbleStore((s) => s.isOpen || s.isExpanded);
  const newConversation = useNewConversation({
    navigateToChat: false,
    preserveNavigation: true,
  });

  const startChat = () => {
    setHistoryOpen(false);
    if (!home) {
      setCollapsed(false);
      setCompactPane("chat");
    }
    newConversation();
    // A conversation URL pins the runtime to that saved thread. Only leave
    // that route; content routes retain their page and unsaved edits.
    if (chatRoute && location.pathname !== "/") {
      openingNewChat.current = true;
      navigate("/");
    }
  };

  useEffect(() => {
    if (requestedChat) {
      setHistoryOpen(false);
      setCollapsed(false);
      setCompactPane("chat");
      useChatBubbleStore.getState().close();
    }
  }, [requestedChat, setCollapsed]);

  return {
    panelOpen,
    currentPage: location.pathname,
    globalHistory,
    home,
    chatOnly,
    pageLabel,
    pageContextPending,
    entityId,
    rootContext: Boolean(
      routeItem &&
      workspaceGroups?.[0]?.items.some(
        (item) =>
          normalizeWorkbenchPath(item.to.split("?")[0]) ===
          normalizeWorkbenchPath(location.pathname),
      ),
    ),
    chatWidth,
    collapsed,
    running,
    setCollapsed,
    compactPane,
    setCompactPane,
    contentCollapsed,
    setContentCollapsed,
    contentHidden,
    historyOpen,
    emptyChat,
    canResumeChat,
    showHistory,
    spaciousChat,
    returnToChat,
    openHistory,
    openGlobalHistory,
    historyShortcut,
    toggleNavigation,
    navGroups,
    workspaceGroups,
    staticNavigationGroups,
    closePanel,
    startChat,
  };
}
