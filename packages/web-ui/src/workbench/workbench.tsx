import { WorkbenchNavigation } from "./navigation.tsx";
import { WorkbenchChatHeader } from "./chat-header.tsx";
import { WorkbenchContentPane } from "./content-pane.tsx";
import { ChatResizeHandle } from "./chat-resize-handle.tsx";
import { ChatEmptyState } from "../components/chat-empty-state.tsx";
import { WelcomeIntro } from "./welcome-intro.tsx";
import { normalizeWorkbenchPath, useWorkbenchState } from "./use-workbench-state.tsx";
import { WorkbenchStyles } from "./workbench-styles.tsx";
import { type ReactNode } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import { ChatContent, TooltipIconButton } from "../index.ts";
import { FileText, MessageSquare, Menu, LoaderCircle } from "lucide-react";
import { ConversationHistory } from "./conversation-history.tsx";
export function WorkbenchPreview({
  page,
  chatOnly: chatRoute = false,
}: {
  page: ReactNode;
  chatOnly?: boolean;
}) {
  const {
    panelOpen,
    currentPage,
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
  } = useWorkbenchState(chatRoute);
  const workspaceId = workspaceGroups?.[0]?.meta?.exclusiveRootId;
  const rootItem = workspaceGroups?.[0]
    ? (workspaceGroups[0].items.find((item) => item.to === workspaceGroups[0].focusOn) ??
      workspaceGroups[0].items[0])
    : undefined;
  const rootContext = Boolean(
    workspaceId &&
    rootItem &&
    normalizeWorkbenchPath(rootItem.to) === normalizeWorkbenchPath(currentPage),
  );
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
  const emptyChatFooter = workspaceId ? conversationHome : historyShortcut;
  const homeRecents = !workspaceId ? (
    <ConversationHistory
      groups={navGroups}
      workspaceId={undefined}
      onClose={returnToChat}
      onViewAll={openHistory}
      showBack={false}
      compact
      home
    />
  ) : undefined;
  const buttonClass =
    "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
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
      />
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-workbench-surface
        role="region"
        aria-label="Workspace working area"
      >
        {chatWidth.compact && (
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
            />
            {!collapsed && showHistory && (
              <ConversationHistory
                groups={navGroups}
                workspaceId={workspaceId}
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
                    <WelcomeIntro
                      navGroups={navGroups}
                      historyShortcut={workspaceId ? emptyChatFooter : null}
                    />
                  ) : undefined
                }
                composerFooter={
                  spaciousChat && emptyChat && !historyOpen && homeRecents ? (
                    <div className="w-full">{homeRecents}</div>
                  ) : undefined
                }
                compactComposer={!spaciousChat}
                starterSuggestions={[]}
                emptyState={
                  <ChatEmptyState pageLabel={pageLabel} showHomeStarters={!spaciousChat}>
                    {emptyChatFooter}
                  </ChatEmptyState>
                }
              />
            </div>
          </section>
          <WorkbenchContentPane
            contentHidden={contentHidden}
            panelOpen={panelOpen}
            chatWidth={chatWidth}
            contentCollapsed={contentCollapsed}
            collapsed={collapsed}
            buttonClass={buttonClass}
            setCollapsed={setCollapsed}
            setContentCollapsed={setContentCollapsed}
            closePanel={closePanel}
            page={page}
          />
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
