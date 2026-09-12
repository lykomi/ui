import { useAuiState } from "@assistant-ui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatContent,
  ThemeToggle,
  UserMenu,
  useSidebarStore,
  Sidebar,
  ToolPanelLayout,
  useChatBubbleStore,
  useToolPanelStore,
  useNewConversation,
  useNavStore,
} from "@iloveagents/foundry-web-ui";
import {
  SquarePen,
  PanelLeft,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  Menu,
  History,
} from "lucide-react";

import { useChatWidth } from "./preview/use-chat-width.ts";
import { ConversationHistory } from "./preview/conversation-history.tsx";
import { SelectionBridge } from "./preview/selection-bridge.tsx";

const STORAGE_KEY = "foundry.workbench-preview";
const COMPOSER_KEY = "foundry.workbench-preview.composer";
function composerChosen() {
  try {
    return sessionStorage.getItem(COMPOSER_KEY) === "on";
  } catch {
    return false;
  }
}
function rememberComposer(chosen: boolean) {
  try {
    if (chosen) sessionStorage.setItem(COMPOSER_KEY, "on");
    else sessionStorage.removeItem(COMPOSER_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}

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

export function WorkbenchPreview({ page }: { page: ReactNode }) {
  const chatWidth = useChatWidth();
  const resizeDrag = useRef<{ x: number; width: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [contentCollapsed, setContentCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [composing, setComposing] = useState(composerChosen);
  const emptyChat = useAuiState(
    (s) =>
      s.thread.messages.length === 0 &&
      !s.thread.isRunning &&
      !s.thread.isLoading &&
      !s.composer.text.trim(),
  );
  const showHistory = historyOpen || (emptyChat && !composing);
  const returnToChat = () => {
    rememberComposer(true);
    setHistoryOpen(false);
    setComposing(true);
  };
  const openHistory = () => {
    rememberComposer(false);
    setComposing(false);
    setHistoryOpen(true);
  };
  const toggleNavigation = useSidebarStore((s) => s.toggleMobile);
  const navGroups = useNavStore((s) => s.config);
  const workspaceGroups = useMemo(() => {
    const workspace = navGroups.find(
      (group) => group.meta?.type === "spaces-workspaces" && group.meta?.exclusiveRootId,
    );
    if (!workspace) return undefined;
    return [workspace];
  }, [navGroups]);
  const panelOpen = useToolPanelStore((s) => s.isOpen);
  useEffect(() => {
    if (panelOpen) setContentCollapsed(false);
  }, [panelOpen]);
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const requestedChat = useChatBubbleStore((s) => s.isOpen || s.isExpanded);
  const newConversation = useNewConversation({ navigateToChat: false, preserveNavigation: true });

  const startChat = () => {
    rememberComposer(true);
    setComposing(true);
    setHistoryOpen(false);
    newConversation();
  };

  useEffect(() => {
    if (requestedChat) {
      setCollapsed(false);
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
        .workbench-preview [data-chat-rail] button svg {
          width: 18px;
          height: 18px;
          stroke-width: 2;
          flex-shrink: 0;
        }
        /* Preview-only hierarchy: workspace title first, quiet section labels,
           and one consistent rhythm for conversation and content rows. */
        [data-workspace-navigation] [data-nav-group-header] .truncate {
          text-transform: none;
          letter-spacing: normal;
          font-size: 12px;
          font-weight: 500;
          color: var(--muted-foreground);
        }
        [data-workspace-navigation] [data-nav-group-label="Workspaces"] > :first-child {
          padding-top: 8px;
        }
        [data-workspace-navigation] [data-nav-group-label="Workspaces"] > div:last-child > [data-nav-depth="0"] {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 22px;
        }
        [data-workspace-navigation] [data-nav-group-label="Recent conversations"] > :first-child {
          padding-top: 10px;
        }
        [data-workspace-navigation] [data-nav-group-label="Contents"] {
          margin-top: 12px;
        }

      `}</style>
      <SelectionBridge>
        <Sidebar
          groups={workspaceGroups}
          hideNewConversation={!!workspaceGroups}
          newConversationLabel="New chat"
          hideFooterActions={!!workspaceGroups}
          onNewConversation={workspaceGroups ? newConversation : undefined}
          footer={
            <footer
              className="shrink-0 border-t border-sidebar-border bg-sidebar px-2 py-2"
              aria-label="Account and appearance"
            >
              <button
                className="mb-1 w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-2"
                title="Reload in classic layout; save edits first"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("ux", "classic");
                  window.location.assign(url.href);
                }}
              >
                UI preview · Restore classic
              </button>
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
        <div ref={chatWidth.containerRef} className="flex min-h-0 min-w-0 flex-1 overflow-x-auto">
          <section
            id="preview-assistant"
            data-chat-collapsed={collapsed ? "true" : undefined}
            aria-label="Assistant conversation"
            className="relative flex min-h-0 shrink-0 flex-col"
            style={{
              width: collapsed ? 44 : contentCollapsed ? "calc(100% - 44px)" : chatWidth.width,
              background: "var(--background)",
            }}
          >
            <div
              data-chat-header
              className={`relative flex shrink-0 items-center ${collapsed ? "justify-center" : "gap-1 px-2"}`}
            >
              {!collapsed && (
                <button
                  className={`${buttonClass} preview-mobile-navigation`}
                  aria-label="Open navigation"
                  onClick={toggleNavigation}
                >
                  <Menu size={18} />
                </button>
              )}
              {collapsed ? (
                <button
                  className={buttonClass}
                  aria-label="Expand chat"
                  title="Expand chat"
                  onClick={() => setCollapsed(false)}
                >
                  <PanelLeftOpen size={18} />
                </button>
              ) : (
                <>
                  <div className="min-w-0 flex-1 px-2 py-2">
                    <div className="text-sm font-semibold">Chat</div>
                  </div>
                  <button
                    className={`${buttonClass} flex items-center gap-1.5 text-xs`}
                    aria-label="Chat history"
                    aria-expanded={showHistory}
                    onClick={() => (showHistory ? returnToChat() : openHistory())}
                  >
                    <History size={18} /> History
                  </button>
                  <button
                    className={buttonClass}
                    title="New chat"
                    aria-label="New chat"
                    onClick={startChat}
                  >
                    <SquarePen size={18} />
                  </button>
                  {!contentCollapsed && (
                    <button
                      className={buttonClass}
                      aria-label="Collapse content"
                      title="Collapse content · expand chat"
                      onClick={() => setContentCollapsed(true)}
                    >
                      <PanelRightClose size={18} />
                    </button>
                  )}
                  <button
                    className={buttonClass}
                    aria-label="Collapse chat"
                    title="Collapse chat"
                    onClick={() => {
                      setContentCollapsed(false);
                      setCollapsed(true);
                    }}
                  >
                    <PanelLeft size={18} />
                  </button>
                </>
              )}
            </div>
            {collapsed && (
              <div data-chat-rail className="flex flex-col items-center gap-1">
                <button
                  className={`${buttonClass} preview-mobile-navigation`}
                  aria-label="Open navigation"
                  title="Open navigation"
                  onClick={toggleNavigation}
                >
                  <Menu size={18} />
                </button>
                <button
                  className={buttonClass}
                  aria-label="Chat history"
                  title="Chat history"
                  onClick={() => {
                    setCollapsed(false);
                    openHistory();
                  }}
                >
                  <History size={18} />
                </button>
              </div>
            )}
            {!collapsed && showHistory && (
              <ConversationHistory
                groups={navGroups}
                workspaceId={workspaceGroups?.[0]?.meta?.exclusiveRootId}
                onClose={returnToChat}
                onNewChat={startChat}
                showBack={!emptyChat || composing}
              />
            )}
            {!collapsed && !contentCollapsed && (
              <div
                role="separator"
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
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  resizeDrag.current = null;
                }}
                onLostPointerCapture={() => {
                  resizeDrag.current = null;
                }}
                onDoubleClick={() => chatWidth.setWidth(null)}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 40 : 10;
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
              style={{ display: collapsed || showHistory ? "none" : "flex" }}
            >
              <ChatContent
                placeholder="Do anything"
                compactComposer
                hiddenPageLabels={workspaceGroups?.flatMap((group) =>
                  group.items.map((item) => item.label),
                )}
                hideCurrentPageBadge
                starterSuggestions={[]}
                emptyState={
                  <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <MessageSquare
                      size={22}
                      strokeWidth={1.5}
                      className="mb-1 text-muted-foreground"
                    />
                    <h1 className="text-base font-medium text-foreground">New chat</h1>
                    <p className="max-w-56 text-sm leading-relaxed text-muted-foreground">
                      Ask a question or select something to discuss.
                    </p>
                  </div>
                }
              />
            </div>
          </section>
          {/* This containing block keeps document and item drawers beside chat. */}
          <section
            aria-label="Working content"
            data-working-content
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              display: contentCollapsed ? "none" : "flex",
              minWidth: collapsed ? 320 : 440,
              transform: "translateZ(0)",
              isolation: "isolate",
            }}
          >
            {panelOpen && (
              <div className="shrink-0 border-b border-border px-3 py-2">
                <button className={buttonClass} onClick={closePanel}>
                  ← Back to content
                </button>
              </div>
            )}
            <ToolPanelLayout contained>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{page}</div>
            </ToolPanelLayout>
          </section>
          {contentCollapsed && (
            <aside
              aria-label="Collapsed content"
              className="flex w-11 shrink-0 flex-col items-center"
              style={{ width: 44 }}
            >
              <div className="flex h-full w-full flex-col items-center" data-chat-rail>
                <div className="flex items-center justify-center" style={{ height: 60 }}>
                  <button
                    className={buttonClass}
                    aria-label="Expand content"
                    title="Expand content"
                    onClick={() => setContentCollapsed(false)}
                  >
                    <PanelRightOpen size={18} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
