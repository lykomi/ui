import { WorkbenchNavigation } from "./navigation.tsx";
import { WorkbenchChatHeader } from "./chat-header.tsx";
import { WorkbenchContentPane } from "./content-pane.tsx";
import { ChatResizeHandle } from "./chat-resize-handle.tsx";
import { ChatEmptyState } from "../components/chat-empty-state.tsx";
import { WelcomeIntro } from "./welcome-intro.tsx";
import { useWorkbenchState } from "./use-workbench-state.tsx";
import { WorkbenchStyles } from "./workbench-styles.tsx";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@lykomi/web-primitives";
import { ChatContent, TooltipIconButton } from "../index.ts";
import type { ChatContentProps } from "../components/assistant-chat.tsx";
import { ChatContentDefaultsContext } from "../components/chat-content-defaults.ts";
import { FileText, MessageSquare, Menu, LoaderCircle } from "lucide-react";
import { ActionListSkeleton } from "../components/action-list-skeleton.tsx";
import { ConversationHistory } from "./conversation-history.tsx";
import { HistoryContent } from "./history-content.tsx";
import { HomeContent } from "./home-content.tsx";
import { HomeDestinations } from "./home-destinations.tsx";
export function WorkbenchPreview({
  page,
  chatPage,
  chatOnly: chatRoute = false,
  defaultSideChatCollapsed = true,
}: {
  page: ReactNode;
  chatPage?: ReactNode;
  chatOnly?: boolean;
  /** Initial desktop side-chat state. Defaults to true; chat-only routes remain expanded. */
  defaultSideChatCollapsed?: boolean;
}) {
  const {
    panelOpen,
    currentPage,
    globalHistory,
    home,
    chatOnly,
    pageLabel,
    pageContextPending,
    entityId,
    rootContext,
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
    spaciousChat: expandedChat,
    returnToChat,
    openHistory,

    toggleNavigation,
    navGroups,
    workspaceGroups,
    staticNavigationGroups,
    closePanel,
    startChat,
  } = useWorkbenchState(chatRoute, defaultSideChatCollapsed);
  const assistantRef = useRef<HTMLElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const chatOpen = chatWidth.compact ? compactPane === "chat" : !collapsed;
  const revealChat = (focus = false) => {
    returnToChat();
    setCollapsed(false);
    setContentCollapsed(false);
    setCompactPane("chat");
    if (focus) setFocusRequest((value) => value + 1);
  };
  useLayoutEffect(() => {
    if (!focusRequest || !chatOpen || showHistory) return;
    const input = assistantRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [focusRequest, chatOpen, showHistory]);
  const workspaceId = workspaceGroups?.[0]?.meta?.exclusiveRootId;
  const conversationHome = (
    <ConversationHistory
      groups={navGroups}
      workspaceId={workspaceId}
      entityId={entityId}
      rootContext={rootContext}
      onClose={returnToChat}
      onViewAll={openHistory}
      showBack={false}
      compact
    />
  );
  const globalHome = home && !workspaceId && !entityId;
  const emptyChatFooter = globalHome ? null : pageContextPending ? (
    <ActionListSkeleton label="Loading recent chats" secondaryText />
  ) : (
    conversationHome
  );
  const homeConversation = globalHome && chatOpen;
  const spaciousChat = expandedChat || homeConversation;
  const buttonClass =
    "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
  const chatDefaults: ChatContentProps = {
    centerComposer: spaciousChat && emptyChat && !historyOpen,
    composerIntro:
      spaciousChat && emptyChat ? (
        <WelcomeIntro
          contextual={Boolean(workspaceId || entityId || pageContextPending)}
          navGroups={navGroups}
          historyShortcut={emptyChatFooter}
        />
      ) : undefined,

    composerFooter:
      globalHome && emptyChat && !historyOpen ? <HomeDestinations groups={navGroups} /> : undefined,
    compactComposer: !spaciousChat && chatWidth.width < 512,
    starterSuggestions: [],
    emptyState: (
      <ChatEmptyState
        pageLabel={globalHome ? undefined : pageLabel}
        contextLoading={pageContextPending}
        showHomeStarters={!spaciousChat && !globalHome}
      >
        {emptyChatFooter}
      </ChatEmptyState>
    ),
  };
  return (
    <div
      className="workbench-preview flex min-h-0 flex-1 overflow-hidden"
      data-workspace-navigation={workspaceGroups ? "true" : undefined}
    >
      <WorkbenchStyles />
      <WorkbenchNavigation
        groups={staticNavigationGroups}
        workspace={!!workspaceGroups}
        onNewConversation={startChat}
        historyOpen={globalHistory}
        onHome={returnToChat}
      />
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-workbench-surface
        role="region"
        aria-label="Workspace working area"
      >
        {chatWidth.compact && !chatOnly && (
          <div
            className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1"
            role="group"
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
                  aria-label={pane === "chat" && running ? "Chat — AI is working" : undefined}
                  onClick={() => setCompactPane(pane)}
                >
                  {pane === "chat" ? (
                    running ? (
                      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none text-primary" />
                    ) : (
                      <MessageSquare className="size-4" />
                    )
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
            ref={assistantRef}
            data-panel-motion
            data-global-chat={spaciousChat || undefined}
            data-chat-collapsed={collapsed ? "true" : undefined}
            inert={chatWidth.compact && !chatOnly && compactPane !== "chat"}
            aria-label="Assistant conversation"
            className="relative flex min-h-0 shrink-0 flex-col"
            style={{
              display: chatWidth.compact && !chatOnly && compactPane !== "chat" ? "none" : "flex",
              width:
                chatWidth.compact || chatOnly || homeConversation
                  ? "100%"
                  : collapsed
                    ? 44
                    : contentCollapsed
                      ? "calc(100% - 44px)"
                      : chatWidth.width,
              background: "var(--background)",
            }}
          >
            <WorkbenchChatHeader
              collapsed={collapsed}
              running={running}
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
              home={globalHome}
              canResumeChat={canResumeChat}
            />
            {!collapsed && showHistory && (
              <ConversationHistory
                groups={navGroups}
                workspaceId={workspaceId}
                onClose={returnToChat}
                showBack={false}
                standalone={globalHome}
                onNewChat={startChat}
              />
            )}
            {!chatWidth.compact && !collapsed && !contentCollapsed && !homeConversation && (
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
              <ChatContentDefaultsContext.Provider value={chatDefaults}>
                {chatPage ?? <ChatContent />}
              </ChatContentDefaultsContext.Provider>
            </div>
          </section>
          <WorkbenchContentPane
            contentHidden={contentHidden || homeConversation}
            panelOpen={panelOpen}
            chatWidth={chatWidth}
            contentCollapsed={contentCollapsed}
            collapsed={collapsed}
            buttonClass={buttonClass}
            setCollapsed={setCollapsed}
            setContentCollapsed={setContentCollapsed}
            closePanel={closePanel}
            page={
              globalHistory ? (
                <HistoryContent
                  groups={navGroups}
                  onResume={() => {
                    returnToChat();
                    setCollapsed(false);
                    setCompactPane("chat");
                  }}
                  onNewChat={startChat}
                />
              ) : globalHome ? (
                <HomeContent groups={navGroups} chatOpen={chatOpen} onOpenChat={revealChat} />
              ) : (
                page
              )
            }
          />
          {contentCollapsed && !chatOnly && !chatWidth.compact && !homeConversation && (
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
