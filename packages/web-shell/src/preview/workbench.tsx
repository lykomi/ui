import { WorkbenchStyles } from "./workbench-styles.tsx";
import { useLocation } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  ChatContent,
  TooltipIconButton,
  ThemeToggle,
  UserMenu,
  useSidebarStore,
  Sidebar,
  ToolPanelLayout,
  useChatBubbleStore,
  useToolPanelStore,
  useNewConversation,
  useNavStore,
  useAppStore,
} from "@iloveagents/foundry-web-ui";
import {
  SquarePen,
  PanelLeft,
  PanelRight,
  FileText,
  MessageSquare,
  Menu,
  History,
  Settings,
  Layers,
} from "lucide-react";

import { useChatWidth } from "./use-chat-width.ts";
import { ConversationHistory } from "./conversation-history.tsx";
import { SelectionBridge } from "./selection-bridge.tsx";

export { isWorkbenchPreviewEnabled } from "../runtime-config.ts";

export function WorkbenchPreview({
  page,
  chatOnly: chatRoute = false,
}: {
  page: ReactNode;
  chatOnly?: boolean;
}) {
  const {
    panelOpen,
    chatOnly,
    pageLabel,
    chatWidth,
    collapsed,
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
  } = useWorkbenchState(chatRoute);
  const buttonClass =
    "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div
      className="workbench-preview flex min-h-0 flex-1 overflow-hidden"
      data-workspace-navigation={workspaceGroups ? "true" : undefined}
    >
      <WorkbenchStyles />
      <SelectionBridge>
        <Sidebar
          groups={staticNavigationGroups}
          collapsedGroupsOnly
          hideNewConversation
          newConversationLabel="New chat"
          hideFooterActions={!!workspaceGroups}
          onNewConversation={startChat}
          footer={
            <footer
              className="shrink-0 border-t border-sidebar-border bg-sidebar px-2 py-2"
              aria-label="Account and appearance"
            >
              <div className="flex min-w-0 items-center justify-between gap-1">
                <UserMenu />
                <ThemeToggle />
              </div>
            </footer>
          }
          collapsedFooter={
            <footer
              className="preview-account-compact flex shrink-0 flex-col items-center border-t border-sidebar-border py-2"
              aria-label="Account and appearance"
            >
              <ThemeToggle />
              <UserMenu />
            </footer>
          }
        />
      </SelectionBridge>
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-workbench-surface
        aria-label="Workspace working area"
      >
        {chatWidth.compact && (
          <div
            className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1"
            aria-label="Workspace panes"
          >
            <Button
              variant="ghost"
              size="icon"
              className="preview-mobile-navigation size-11"
              aria-label="Open navigation"
              onClick={toggleNavigation}
            >
              <Menu className="size-4" />
            </Button>
            {(["content", "chat"] as const)
              .filter((pane) => !chatOnly || pane === "chat")
              .map((pane) => (
                <Button
                  key={pane}
                  variant="ghost"
                  className="h-11 gap-1.5 px-3 aria-pressed:bg-muted"
                  aria-pressed={chatOnly || compactPane === pane}
                  aria-controls={pane === "chat" ? "preview-assistant" : "preview-content"}
                  onClick={() => setCompactPane(pane)}
                >
                  {pane === "chat" ? (
                    <MessageSquare className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  {pane === "chat" ? "Chat" : "Content"}
                </Button>
              ))}
          </div>
        )}
        <div
          ref={chatWidth.containerRef}
          className="relative flex min-h-0 min-w-0 flex-1 overflow-x-auto"
        >
          <section
            id="preview-assistant"
            data-panel-motion
            data-global-chat={spaciousChat || undefined}
            data-chat-collapsed={collapsed ? "true" : undefined}
            inert={chatWidth.compact && !chatOnly && compactPane !== "chat"}
            aria-label="Assistant conversation"
            className="relative flex min-h-0 shrink-0 flex-col"
            style={{
              display: chatWidth.compact && !chatOnly && compactPane !== "chat" ? "none" : "flex",
              width:
                chatWidth.compact || chatOnly
                  ? "100%"
                  : collapsed
                    ? 44
                    : contentCollapsed
                      ? "calc(100% - 44px)"
                      : chatWidth.width,
              background: "var(--background)",
            }}
          >
            <ChatHeader
              collapsed={collapsed}
              chatWidth={chatWidth}
              buttonClass={buttonClass}
              toggleNavigation={toggleNavigation}
              setCollapsed={setCollapsed}
              showHistory={showHistory}
              startChat={startChat}
              returnToChat={returnToChat}
              openHistory={openHistory}
              chatOnly={chatOnly}
              setContentCollapsed={setContentCollapsed}
            />
            {!collapsed && showHistory && (
              <ConversationHistory
                groups={navGroups}
                workspaceId={workspaceGroups?.[0]?.meta?.exclusiveRootId}
                onClose={returnToChat}
                showBack
              />
            )}
            {!chatWidth.compact && !collapsed && !contentCollapsed && (
              <ChatResizeHandle chatWidth={chatWidth} />
            )}
            {/* Keep the same runtime/composer mounted when the rail collapses. */}
            <div
              className="min-h-0 flex-1 flex-col"
              style={{
                display: collapsed || showHistory ? "none" : "flex",
                paddingBottom:
                  spaciousChat && emptyChat && !historyOpen ? "clamp(32px, 10vh, 96px)" : undefined,
              }}
            >
              <ChatContent
                centerComposer={spaciousChat && emptyChat && !historyOpen}
                composerIntro={
                  spaciousChat && emptyChat ? (
                    <WelcomeIntro navGroups={navGroups} historyShortcut={historyShortcut} />
                  ) : undefined
                }
                placeholder={chatOnly ? "Ask anything" : "Ask about this page…"}
                compactComposer={!spaciousChat}
                hiddenPageLabels={workspaceGroups?.flatMap((group) =>
                  group.items.map((item) => item.label),
                )}
                hideCurrentPageBadge
                showPinButton={false}
                starterSuggestions={[]}
                emptyState={
                  <div className="flex min-h-full flex-col justify-center gap-3 px-6 py-8">
                    <h1 className="text-lg font-semibold tracking-tight">
                      What would you like to get done?
                    </h1>
                    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                      {pageLabel && !pageLabel.startsWith("/") ? (
                        <>
                          Work with <span className="font-medium text-foreground">{pageLabel}</span>{" "}
                          or across your spaces: find information, create or edit content, and run
                          actions.
                        </>
                      ) : (
                        "Find information, create or edit content, and run actions across your spaces."
                      )}
                    </p>
                    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Your conversation continues as you browse. Select text or a field to work more
                      specifically.
                    </p>
                    {historyShortcut}
                  </div>
                }
              />
            </div>
          </section>
          {/* This containing block keeps document and item drawers beside chat. */}
          <section
            id="preview-content"
            aria-label="Working content"
            data-working-content
            data-panel-motion
            data-content-collapsed={contentHidden || undefined}
            inert={contentHidden}
            data-item-panel-open={panelOpen || undefined}
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              display: contentHidden ? "none" : "flex",
              minWidth: chatWidth.compact ? 0 : contentCollapsed ? 44 : collapsed ? 320 : 440,
              transform: "translateZ(0)",
              isolation: "isolate",
            }}
          >
            {!chatWidth.compact && (
              <TooltipIconButton
                data-content-collapse
                tooltip="Collapse content"
                className={buttonClass}
                aria-label="Collapse content"
                style={contentHidden ? { display: "none" } : undefined}
                onClick={() => {
                  setCollapsed(false);
                  setContentCollapsed(true);
                }}
              >
                <PanelRight size={18} />
              </TooltipIconButton>
            )}
            <div
              className="min-h-0 flex-1 flex-col overflow-hidden"
              style={{ display: contentHidden ? "none" : "flex" }}
            >
              {panelOpen && (
                <div
                  className="flex shrink-0 items-center border-b border-border pl-3 pr-14"
                  style={{ minHeight: 60 }}
                >
                  <button className={buttonClass} onClick={closePanel}>
                    ← Back to content
                  </button>
                </div>
              )}
              <ToolPanelLayout contained>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{page}</div>
              </ToolPanelLayout>
            </div>
          </section>
          {contentCollapsed && !chatOnly && !chatWidth.compact && (
            <aside
              aria-label="Collapsed content"
              className="flex w-11 shrink-0 flex-col items-center"
              style={{ width: 44 }}
            >
              <div className="flex h-full w-full flex-col items-center" data-chat-rail>
                <div className="flex items-center justify-center" style={{ height: 60 }}>
                  <TooltipIconButton
                    tooltip="Expand content"
                    className={buttonClass}
                    aria-label="Expand content"
                    onClick={() => setContentCollapsed(false)}
                  >
                    <FileText size={18} />
                  </TooltipIconButton>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatResizeHandle({ chatWidth }: { chatWidth: ReturnType<typeof useChatWidth> }) {
  const resizeDrag = useRef<{ x: number; width: number } | null>(null);
  return (
    <div
      role="separator"
      data-panel-resize
      aria-label="Resize chat"
      aria-orientation="vertical"
      aria-valuemin={chatWidth.min}
      aria-valuemax={chatWidth.max}
      aria-valuenow={chatWidth.width}
      tabIndex={0}
      title="Drag to resize chat. Double-click to reset."
      className="absolute inset-y-0 z-40 w-2 cursor-col-resize touch-none hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
      style={{ right: -4 }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.closest("[data-workbench-surface]")?.setAttribute("data-resizing", "");
        resizeDrag.current = { x: event.clientX, width: chatWidth.width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (resizeDrag.current)
          chatWidth.setWidth(resizeDrag.current.width + event.clientX - resizeDrag.current.x);
      }}
      onPointerUp={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
      }}
      onLostPointerCapture={(event) => {
        resizeDrag.current = null;
        event.currentTarget.closest("[data-workbench-surface]")?.removeAttribute("data-resizing");
      }}
      onDoubleClick={() => chatWidth.setWidth(null)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 16;
        if (event.key === "ArrowLeft") chatWidth.setWidth(chatWidth.width - step);
        else if (event.key === "ArrowRight") chatWidth.setWidth(chatWidth.width + step);
        else if (event.key === "Home") chatWidth.setWidth(chatWidth.min);
        else if (event.key === "End") chatWidth.setWidth(chatWidth.max);
        else return;
        event.preventDefault();
      }}
    />
  );
}

function WelcomeIntro({
  navGroups,
  historyShortcut,
}: {
  navGroups: ReturnType<typeof useNavStore.getState>["config"];
  historyShortcut: ReactNode;
}) {
  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">What would you like to get done?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Find information, create or edit content, and run actions across your spaces.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {historyShortcut}
        {navGroups.some(
          (group) => group.meta?.type === "spaces-workspaces" && group.createActions?.length,
        ) && (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 text-xs font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
                >
                  <Layers className="size-3.5" aria-hidden="true" />
                  Create a space
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {navGroups
                  .filter((group) => group.meta?.type === "spaces-workspaces")
                  .flatMap((group) => group.createActions ?? [])
                  .map((action) => (
                    <DropdownMenuItem key={action.id} onSelect={() => action.handler()}>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatHeader({
  collapsed,
  chatWidth,
  buttonClass,
  toggleNavigation,
  setCollapsed,
  showHistory,
  startChat,
  returnToChat,
  openHistory,
  chatOnly,
  setContentCollapsed,
}: {
  collapsed: boolean;
  chatWidth: ReturnType<typeof useChatWidth>;
  buttonClass: string;
  toggleNavigation: () => void;
  setCollapsed: (value: boolean) => void;
  showHistory: boolean;
  startChat: () => void;
  returnToChat: () => void;
  openHistory: () => void;
  chatOnly: boolean;
  setContentCollapsed: (value: boolean) => void;
}) {
  return (
    <>
      <div
        data-chat-header
        className={`relative flex shrink-0 items-center ${collapsed ? "justify-center" : "gap-1 px-2"}`}
      >
        {!collapsed && !chatWidth.compact && (
          <TooltipIconButton
            tooltip="Open navigation"
            className={`${buttonClass} preview-mobile-navigation`}
            aria-label="Open navigation"
            onClick={toggleNavigation}
          >
            <Menu size={18} />
          </TooltipIconButton>
        )}
        {collapsed ? (
          <TooltipIconButton
            tooltip="Expand chat"
            className={buttonClass}
            aria-label="Expand chat"
            onClick={() => setCollapsed(false)}
          >
            <MessageSquare size={18} />
          </TooltipIconButton>
        ) : (
          <>
            <div className="min-w-0 flex-1 px-2 py-2">
              <div className="text-sm font-semibold">{showHistory ? "Conversations" : "Chat"}</div>
            </div>
            <TooltipIconButton
              tooltip="New chat"
              className={buttonClass}
              aria-label="New chat"
              onClick={startChat}
            >
              <SquarePen size={18} />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Chat history"
              className={buttonClass}
              aria-label="Chat history"
              aria-expanded={showHistory}
              onClick={() => (showHistory ? returnToChat() : openHistory())}
            >
              <History size={18} />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Collapse chat"
              style={chatOnly || chatWidth.compact ? { display: "none" } : undefined}
              className={buttonClass}
              aria-label="Collapse chat"
              onClick={() => {
                setContentCollapsed(false);
                setCollapsed(true);
              }}
            >
              <PanelLeft size={18} />
            </TooltipIconButton>
          </>
        )}
      </div>
      {collapsed && (
        <div data-chat-rail className="flex flex-col items-center gap-1">
          <TooltipIconButton
            tooltip="Open navigation"
            className={`${buttonClass} preview-mobile-navigation`}
            aria-label="Open navigation"
            onClick={toggleNavigation}
          >
            <Menu size={18} />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Chat history"
            className={buttonClass}
            aria-label="Chat history"
            onClick={() => {
              setCollapsed(false);
              openHistory();
            }}
          >
            <History size={18} />
          </TooltipIconButton>
        </div>
      )}
    </>
  );
}

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
          items: root ? [{ ...root, children: undefined }] : space.items,
        },
        {
          label: "Content",
          hideLabel: true,
          priority: 800,
          items: root?.children ?? [],
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

function useWorkbenchState(chatRoute: boolean) {
  const panelOpen = useToolPanelStore((s) => s.isOpen && !s.isWindowHosted);
  const chatOnly = chatRoute && !panelOpen;
  const location = useLocation();
  const pageLabel = useAppStore((s) => s.navContext.label);
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
      className="h-8 w-fit gap-2 px-3 text-xs font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
    >
      <History className="size-3.5" aria-hidden />
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
      setCollapsed(false);
      setCompactPane("chat");
      useChatBubbleStore.getState().close();
    }
  }, [requestedChat]);

  return {
    panelOpen,
    chatOnly,
    pageLabel,
    chatWidth,
    collapsed,
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
