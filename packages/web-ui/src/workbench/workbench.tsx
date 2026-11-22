import { WorkbenchNavigation } from "./navigation.tsx";
import { WorkbenchChatHeader } from "./chat-header.tsx";
import { WorkbenchContentPane } from "./content-pane.tsx";
import { ChatResizeHandle } from "./chat-resize-handle.tsx";
import { ChatEmptyState } from "../components/chat-empty-state.tsx";
import { WelcomeIntro } from "./welcome-intro.tsx";
import { useWorkbenchState } from "./use-workbench-state.tsx";
import { WorkbenchStyles } from "./workbench-styles.tsx";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { Button } from "@lykomi/web-primitives";
import { ChatContent, TooltipIconButton } from "../index.ts";
import type { ChatContentProps } from "../components/assistant-chat.tsx";
import { ChatContentDefaultsContext } from "../components/chat-content-defaults.ts";
import { FileText, MessageSquare, Menu, LoaderCircle } from "lucide-react";
import { ActionListSkeleton } from "../components/action-list-skeleton.tsx";
import { ConversationHistory } from "./conversation-history.tsx";
import { HistoryContent } from "./history-content.tsx";
import { ChatPanelToggle } from "./chat-panel-toggle.tsx";
import { useChatSlotsStore } from "../components/chat-slots.tsx";
import { HomeDestinations } from "./home-destinations.tsx";
const noDocument = () => null;
const noDocumentTabs = () => false;
const noDocumentSubscription = () => () => {};

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
  const workspaceId = workspaceGroups?.[0]?.meta?.exclusiveRootId;
  const globalHome = home && !workspaceId && !entityId;
  const workingDocument = useChatSlotsStore((s) => s.workingDocument);
  const activeDocument = useSyncExternalStore(
    workingDocument?.subscribe ?? noDocumentSubscription,
    workingDocument?.getActiveId ?? noDocument,
    noDocument,
  );
  const hasDocumentTabs = useSyncExternalStore(
    workingDocument?.subscribe ?? noDocumentSubscription,
    workingDocument?.hasTabs ?? noDocumentTabs,
    noDocumentTabs,
  );
  const sidePanelOpen = chatWidth.compact ? compactPane === "chat" : !collapsed;
  const homeFullChat = globalHome && !sidePanelOpen && !activeDocument && !panelOpen;
  const EmptyTabBar =
    !workspaceGroups && !entityId && !hasDocumentTabs && !homeFullChat
      ? workingDocument?.EmptyTabBar
      : undefined;
  const chatOpen = homeFullChat || sidePanelOpen;
  const setSidePanelOpen = (open: boolean) => {
    if (chatWidth.compact) setCompactPane(open ? "chat" : "content");
    else {
      setContentCollapsed(false);
      setCollapsed(!open);
    }
  };
  useEffect(() => {
    if (globalHome && activeDocument && chatWidth.compact) setCompactPane("content");
  }, [activeDocument, chatWidth.compact, globalHome, setCompactPane]);
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
  const emptyChatFooter = globalHome ? null : pageContextPending ? (
    <ActionListSkeleton label="Loading recent chats" secondaryText />
  ) : (
    conversationHome
  );
  const spaciousChat = expandedChat || homeFullChat;
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
      homeFullChat && emptyChat && !historyOpen ? (
        <HomeDestinations groups={navGroups} />
      ) : undefined,
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
  const assistant = (
    <section
      id="preview-assistant"
      data-panel-motion
      data-global-chat={spaciousChat || undefined}
      data-home-chat={homeFullChat || undefined}
      inert={!chatOpen}
      aria-label="Assistant conversation"
      className="relative flex min-h-0 min-w-0 shrink-0 flex-col"
      style={{
        display: chatOpen ? "flex" : "none",
        width: homeFullChat
          ? "auto"
          : chatWidth.compact || chatOnly
            ? globalHome
              ? "calc(100% - 44px)"
              : "100%"
            : contentCollapsed
              ? "calc(100% - 88px)"
              : chatWidth.width,
        background: "var(--background)",
      }}
    >
      <WorkbenchChatHeader
        chatWidth={chatWidth}
        buttonClass={buttonClass}
        toggleNavigation={toggleNavigation}
        showHistory={showHistory}
        startChat={startChat}
        returnToChat={returnToChat}
        openHistory={openHistory}
        canResumeChat={canResumeChat}
      />
      {chatOpen && showHistory && (
        <ConversationHistory
          groups={navGroups}
          workspaceId={workspaceId}
          onClose={returnToChat}
          showBack={false}
          standalone={homeFullChat}
          onNewChat={startChat}
        />
      )}
      {!chatWidth.compact && !collapsed && !contentCollapsed && !homeFullChat && (
        <ChatResizeHandle chatWidth={chatWidth} />
      )}
      {/* Keep the same runtime/composer mounted when the rail collapses. */}
      <div
        className="min-h-0 flex-1 flex-col"
        style={{
          display: !chatOpen || showHistory ? "none" : "flex",
          paddingBottom:
            spaciousChat && emptyChat && !historyOpen ? "clamp(32px, 10vh, 96px)" : undefined,
        }}
      >
        <ChatContentDefaultsContext.Provider value={chatDefaults}>
          {chatPage ?? <ChatContent />}
        </ChatContentDefaultsContext.Provider>
      </div>
    </section>
  );
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
            {!globalHome &&
              (["content", "chat"] as const)
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
          data-home-full-chat={homeFullChat || undefined}
          className="relative flex min-h-0 min-w-0 flex-1 overflow-x-auto"
        >
          {(!chatWidth.compact || globalHome) && (
            <aside
              data-chat-rail
              aria-label="Chat panel bar"
              className="flex w-11 shrink-0 flex-col items-center border-r border-border bg-background"
            >
              <div data-chat-header className="flex w-full items-center justify-center">
                <ChatPanelToggle
                  home={globalHome}
                  running={running}
                  expanded={sidePanelOpen}
                  onOpen={() => setSidePanelOpen(!sidePanelOpen)}
                />
              </div>
            </aside>
          )}
          {assistant}
          <WorkbenchContentPane
            contentHidden={contentHidden && !homeFullChat}
            toolbarOnly={homeFullChat}
            tabBar={EmptyTabBar && <EmptyTabBar />}
            canCollapse={!homeFullChat}
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
              ) : globalHome && !activeDocument && !panelOpen ? (
                <section
                  data-home-content
                  aria-label="Home"
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-10"
                >
                  <div className="mx-auto w-full max-w-3xl text-center">
                    <HomeDestinations groups={navGroups} />
                  </div>
                </section>
              ) : (
                page
              )
            }
          />
          {contentCollapsed && !chatOnly && !chatWidth.compact && !homeFullChat && (
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
