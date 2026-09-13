import { useLocation } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import {
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

import { useChatWidth } from "./preview/use-chat-width.ts";
import { ConversationHistory } from "./preview/conversation-history.tsx";
import { SelectionBridge } from "./preview/selection-bridge.tsx";

const STORAGE_KEY = "foundry.workbench-preview";
/** Tab-local and development-only. Production always uses the standard shell. */
export function isWorkbenchPreviewEnabled() {
  if (!import.meta.env.DEV) return false;
  try {
    const choice = new URLSearchParams(window.location.search).get("ux");
    if (choice === "workbench") sessionStorage.setItem(STORAGE_KEY, "on");
    if (choice === "classic") sessionStorage.removeItem(STORAGE_KEY);
    return sessionStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function WorkbenchPreview({
  page,
  chatOnly = false,
}: {
  page: ReactNode;
  chatOnly?: boolean;
}) {
  const location = useLocation();
  const pageLabel = useAppStore((s) => s.navContext.label);
  const chatWidth = useChatWidth();
  const resizeDrag = useRef<{ x: number; width: number } | null>(null);
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
      variant="outline"
      size="sm"
      onClick={openHistory}
      className="mt-2 w-fit gap-2 [@media(pointer:coarse)]:min-h-11"
    >
      <History className="size-4" aria-hidden />
      Conversation history
    </Button>
  );
  const toggleNavigation = useSidebarStore((s) => s.toggleMobile);
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
  const panelOpen = useToolPanelStore((s) => s.isOpen);
  useEffect(() => {
    if (panelOpen) {
      setContentCollapsed(false);
      setCompactPane("content");
    }
  }, [panelOpen]);
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const requestedChat = useChatBubbleStore((s) => s.isOpen || s.isExpanded);
  const newConversation = useNewConversation({ navigateToChat: false, preserveNavigation: true });

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

  const buttonClass =
    "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div
      className="workbench-preview flex min-h-0 flex-1 overflow-hidden"
      data-workspace-navigation={workspaceGroups ? "true" : undefined}
    >
      <style>{`
        .workbench-preview [data-panel-resize] {
          width: 12px;
          right: 0 !important;
          z-index: 40;
          touch-action: none;
          background: transparent;
          outline: none;
        }
        .workbench-preview [data-panel-resize] > div { display: none; }
        .workbench-preview [data-panel-resize]::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 3px;
          width: 6px;
          height: 56px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: var(--border);
          box-shadow: 0 1px 2px #00000014;
          opacity: 0;
          transition: opacity 120ms ease;
        }
        .workbench-preview [data-panel-resize]:hover::after,
        .workbench-preview [data-panel-resize]:focus-visible::after,
        .workbench-preview [data-panel-resize]:active::after { opacity: 1; }
        .workbench-preview select:not([multiple]):not([size]),
        .workbench-preview select[size="1"]:not([multiple]) {
          appearance: none;
          padding-right: 36px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px 16px;
        }
        .preview-account-compact button > span { display: none; }
        .workbench-preview #preview-assistant textarea::placeholder {
          font-size: 14px;
          font-weight: 400;
          color: color-mix(in srgb, var(--muted-foreground) 65%, var(--background));
          opacity: 1;
        }
        .workbench-preview #preview-assistant button[aria-label="Add to this message"] {
          width: 32px;
          height: 32px;
          margin-left: -8px;
          padding: 0;
        }
        .workbench-preview #preview-assistant button[aria-label="Add to this message"] svg {
          width: 16px;
          height: 16px;
        }

        .workbench-preview #preview-assistant button[aria-label="Send message"],
        .workbench-preview #preview-assistant button[aria-label="Stop generating"] {
          width: 32px;
          height: 32px;
          min-width: 32px;
          padding: 0;
        }

        .workbench-preview .preview-mobile-navigation { display: none; }
        @media (max-width: 767px) {
          .workbench-preview .preview-mobile-navigation { display: inline-flex; }
        }
        .workbench-preview [data-chat-collapsed="true"] [data-chat-header] button,
        .workbench-preview [data-chat-rail] button {
          width: 36px;
          max-width: 36px;
          flex-shrink: 0;
          padding: 8px;
        }

        .workbench-preview [data-chat-composer-divider] { display: none; }
        .workbench-preview [data-global-chat] section[aria-label="Chat history"] {
          width: 100%; max-width: 48rem; margin-left: auto; margin-right: auto;
          box-sizing: border-box;
        }
        .workbench-preview [data-global-chat] form { border-radius: 16px; }
        /* One motion treatment for navigation and both working panes. */
        .workbench-preview [data-sidebar-surface],
        .workbench-preview [data-panel-motion] {
          transition: width 200ms ease-in-out, min-width 200ms ease-in-out;
        }
        .workbench-preview [data-resizing] [data-panel-motion] { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .workbench-preview [data-sidebar-surface],
          .workbench-preview [data-panel-motion] { transition: none; }
        }
        .workbench-preview [data-sidebar-collapsed] button,
        .workbench-preview [data-sidebar-collapsed] a {
          width: 36px; height: 36px; min-width: 36px; padding: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          align-self: center; border-radius: 8px;
        }
        .workbench-preview [data-sidebar-collapsed] svg {
          width: 18px; height: 18px; stroke-width: 2;
        }
        .workbench-preview {
          --workbench-header-height: 60px;
          --sidebar: color-mix(in srgb, var(--background) 98.5%, var(--foreground) 1.5%);
          background: var(--sidebar);
          --workbench-outline: color-mix(in srgb, var(--sidebar-ring) 28%, transparent);
          padding: 8px 8px 8px 0;
        }
        .workbench-preview [data-workbench-surface] {
          position: relative;
          border-radius: 12px;
          background: var(--background);
        }
        .workbench-preview [data-workbench-surface]::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border: 1px solid var(--workbench-outline);

          border-radius: inherit;
          z-index: 30;
        }
        .workbench-preview #preview-assistant::after {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          pointer-events: none;
          background: color-mix(in srgb, var(--border) 55%, transparent);
        }

        @container hdr (max-width: 700px) {
          .workbench-preview [data-entity-header-identity] {
            flex-basis: 100%;
          }
          .workbench-preview [data-entity-header-identity] h1 {
            min-width: 0;
          }
        }
        .workbench-preview [data-navigation-header],
        .workbench-preview [data-chat-header] {
          height: var(--workbench-header-height);
          min-height: var(--workbench-header-height);
          box-sizing: border-box;
          padding-top: 0;
          padding-bottom: 0;
          align-items: center;
        }
        .workbench-preview [data-navigation-header] button,
        .workbench-preview [data-chat-header] button {
          height: 36px;
          min-width: 36px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }
        .workbench-preview [data-navigation-header] button,
        .workbench-preview [data-chat-header] button,
        .workbench-preview [data-chat-rail] button {
          color: var(--muted-foreground);
          background-color: transparent;
        }
        .workbench-preview [data-navigation-header] button:hover,
        .workbench-preview [data-chat-header] button:hover,
        .workbench-preview [data-chat-rail] button:hover {
          color: var(--foreground);
          background-color: var(--muted);
        }
        .workbench-preview [data-navigation-header] button svg,
        .workbench-preview [data-chat-header] button svg,
        .workbench-preview [data-content-collapse] svg,
        .workbench-preview [data-chat-rail] button svg {
          width: 18px;
          height: 18px;
          stroke-width: 2;
          flex-shrink: 0;
        }
        .workbench-preview [data-content-collapse] {
          position: absolute;
          top: calc((var(--workbench-header-height) - 36px) / 2);
          right: var(--workbench-inline-padding, 16px);
          width: 36px;
          height: 36px;
          padding: 8px;
          z-index: 20;
        }
        .workbench-preview [data-working-content]:has(> [data-content-collapse]) [data-preview-entity-header] > [data-entity-header-row] {
          padding-right: var(--workbench-header-actions-inset, calc(var(--workbench-inline-padding, 16px) + 44px));
        }
        .workbench-preview [data-working-content]:not(:has([data-entity-header-row])):not([data-item-panel-open]) {
          padding-top: var(--workbench-header-height);
        }
        @media print {
          .workbench-preview [data-content-collapse] { display: none; }
        }
        .workbench-preview [data-conversation-row] {
          color: var(--sidebar-foreground);
          font-size: 14px;
          line-height: 20px;
        }
        /* Preview-only hierarchy: workspace title first, quiet section labels,
           and one consistent rhythm for conversation and content rows. */
        .workbench-preview [data-nav-group-header],
        .workbench-preview [data-conversation-section-label] {
          min-height: 32px;
          gap: 0;
          background: transparent;
          font-size: 12px;
          font-weight: 500;
          line-height: 16px;
          letter-spacing: normal;
          text-transform: none;
          color: var(--muted-foreground);
        }
        .workbench-preview [data-nav-group-header] span:not([data-nav-status-dot]) {
          font-size: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-transform: none;
          color: inherit;
        }
        .workbench-preview [data-nav-group-header] > span[aria-hidden="true"] {
          display: none;
        }
        .workbench-preview [data-nav-group-label] > div:has(> [data-nav-group-header]) {
          padding-top: 18px;
          padding-bottom: 2px;
        }
        .workbench-preview [data-conversation-row],
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth] {
          min-height: 36px;
          padding-top: 6px;
          padding-bottom: 6px;
          gap: 10px;
          border-radius: 8px;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth="0"] {
          padding-left: 12px;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth="0"] > [data-nav-twisty-cell] {
          display: none;
        }
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth] {
          padding-top: 0;
          padding-bottom: 0;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth="0"] {
          padding-left: 0;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth="0"] > button:not([data-nav-twisty]) {
          padding-left: 12px;
          min-height: 36px;
          gap: 10px;
        }
        [data-workspace-navigation] [data-nav-group-label="Spaces"] > :first-child {
          padding-top: 8px;
        }
        [data-workspace-navigation] [data-nav-group-label="Spaces"] [data-nav-depth="0"] > button {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 22px;
        }
        [data-workspace-navigation] [data-nav-group-label="Recent chats"] > :first-child {
          padding-top: 10px;
        }
        [data-workspace-navigation] [data-nav-group-label="Content"] {
          margin-top: 6px;
        }
        [data-workspace-navigation] [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Content"] > div {
          margin-left: 14px;
          border-left: 1px solid color-mix(in srgb, var(--sidebar-foreground) 12%, transparent);
          padding-left: 4px;
        }

        @media (pointer: coarse) {
          .workbench-preview [data-conversation-row],
          .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth] {
            min-height: 44px;
          }
        }
      `}</style>
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
                    <div className="text-sm font-semibold">
                      {showHistory ? "Conversations" : "Chat"}
                    </div>
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
            {!collapsed && showHistory && (
              <ConversationHistory
                groups={navGroups}
                workspaceId={workspaceGroups?.[0]?.meta?.exclusiveRootId}
                onClose={returnToChat}
                showBack
              />
            )}
            {!chatWidth.compact && !collapsed && !contentCollapsed && (
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
                  event.currentTarget
                    .closest("[data-workbench-surface]")
                    ?.setAttribute("data-resizing", "");
                  resizeDrag.current = { x: event.clientX, width: chatWidth.width };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (resizeDrag.current)
                    chatWidth.setWidth(
                      resizeDrag.current.width + event.clientX - resizeDrag.current.x,
                    );
                }}
                onPointerUp={(event) => {
                  resizeDrag.current = null;
                  event.currentTarget
                    .closest("[data-workbench-surface]")
                    ?.removeAttribute("data-resizing");
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={(event) => {
                  resizeDrag.current = null;
                  event.currentTarget
                    .closest("[data-workbench-surface]")
                    ?.removeAttribute("data-resizing");
                }}
                onLostPointerCapture={(event) => {
                  resizeDrag.current = null;
                  event.currentTarget
                    .closest("[data-workbench-surface]")
                    ?.removeAttribute("data-resizing");
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
                    <div className="mb-6 text-center">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        What would you like to get done?
                      </h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Find information, create or edit content, and run actions across your
                        spaces.
                      </p>
                      {historyShortcut}
                    </div>
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
