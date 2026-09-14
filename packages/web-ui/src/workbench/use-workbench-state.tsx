import { useLocation } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import {
  useSidebarStore,
  useChatBubbleStore,
  useToolPanelStore,
  useNewConversation,
  useNavStore,
  useAppStore,
} from "../index.ts";
import { History, Settings, Layers } from "lucide-react";
import { useChatWidth } from "./use-chat-width.ts";
function useWorkbenchNavigation() {
  const navGroups = useNavStore((s) => s.config);
  const workspaceGroups = useMemo(() => {
    const workspace = navGroups.find(
      (group) => group.meta?.type === "spaces-workspaces" && group.meta?.exclusiveRootId,
    );
    if (!workspace) return undefined;
    return [workspace];
  }, [navGroups]);
  const navigationGroups = useMemo(() => {
    if (workspaceGroups) {
      const space = workspaceGroups[0];
      const root = space.items.find((item) => item.to === space.focusOn) ?? space.items[0];
      return [
        {
          ...space,
          label: "Spaces",
          icon: Layers,
          priority: 1000,
          items: root
            ? [{ ...root, children: root.childrenHidden ? root.children : undefined }]
            : space.items,
        },
        {
          label: "Content",
          tree: true,
          hideLabel: true,
          priority: 800,
          items: root?.childrenHidden ? [] : (root?.children ?? []),
          meta: { hideInCollapsedRail: true },
        },
      ];
    }
    return [
      ...navGroups
        .filter((group) => !["recent-chats", "pinned-chats"].includes(String(group.meta?.type)))
        .map((group) =>
          group.meta?.type === "spaces-workspaces"
            ? { ...group, label: "Spaces", icon: Layers }
            : group.label === "Admin"
              ? { ...group, icon: Settings }
              : group.label === "Activity"
                ? { ...group, priority: 1100 }
                : group,
        ),
    ];
  }, [workspaceGroups, navGroups]);
  const staticNavigationGroups = useMemo(
    () => navigationGroups.map((group) => ({ ...group, collapsible: false })),
    [navigationGroups],
  );
  return { navGroups, workspaceGroups, staticNavigationGroups };
}

export function useWorkbenchState(chatRoute: boolean) {
  const panelOpen = useToolPanelStore((s) => s.isOpen && !s.isWindowHosted);
  const chatOnly = chatRoute && !panelOpen;
  const location = useLocation();
  const pageLabel = useAppStore((s) => s.navContext.label);
  const entityId = useAppStore((s) => s.navContext.meta?.spacesEntityId);
  const chatWidth = useChatWidth();
  const [desktopCollapsed, setCollapsed] = useState(false);
  const collapsed = !chatWidth.compact && desktopCollapsed;
  const [compactPane, setCompactPane] = useState<"chat" | "content">(chatOnly ? "chat" : "content");
  const [contentCollapsed, setContentCollapsed] = useState(false);
  const contentHidden =
    chatOnly || (chatWidth.compact ? compactPane !== "content" : contentCollapsed);
  useEffect(() => {
    setContentCollapsed(chatOnly);
    setCompactPane(chatOnly ? "chat" : "content");
    if (chatOnly) setCollapsed(false);
    // Navigation is an explicit request to see content, including selecting
    // the same address again. Collapsing remains local until the next entry.
  }, [chatOnly, location.key]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const running = useAuiState((s) => s.thread.isRunning);
  const emptyChat = useAuiState(
    (s) => s.thread.messages.length === 0 && !s.thread.isRunning && !s.thread.isLoading,
  );
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
  const historyShortcut = (
    <Button
      variant="ghost"
      size="sm"
      onClick={openHistory}
      className="h-9 w-fit gap-2 px-2 text-sm font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
    >
      <History className="size-4" aria-hidden />
      Conversation history
    </Button>
  );
  const toggleNavigation = useSidebarStore((s) => s.toggleMobile);
  const { navGroups, workspaceGroups, staticNavigationGroups } = useWorkbenchNavigation();
  useEffect(() => {
    if (panelOpen) {
      setContentCollapsed(false);
      setCompactPane("content");
    }
  }, [panelOpen]);
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const requestedChat = useChatBubbleStore((s) => s.isOpen || s.isExpanded);
  const newConversation = useNewConversation({
    navigateToChat: chatRoute,
    preserveNavigation: !chatRoute,
  });

  const startChat = () => {
    setHistoryOpen(false);
    setCompactPane("chat");
    newConversation();
  };

  useEffect(() => {
    if (requestedChat) {
      setHistoryOpen(false);
      setCollapsed(false);
      setCompactPane("chat");
      useChatBubbleStore.getState().close();
    }
  }, [requestedChat]);

  return {
    panelOpen,
    chatOnly,
    pageLabel,
    entityId,
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
    showHistory,
    spaciousChat,
    returnToChat,
    openHistory,
    historyShortcut,
    toggleNavigation,
    navGroups,
    workspaceGroups,
    staticNavigationGroups,
    closePanel,
    startChat,
  };
}
