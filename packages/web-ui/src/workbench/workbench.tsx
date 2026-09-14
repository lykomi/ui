import { WorkbenchNavigation } from "./navigation.tsx";
import { WorkbenchChatHeader } from "./chat-header.tsx";
import { WorkbenchContentPane } from "./content-pane.tsx";
import { ChatResizeHandle } from "./chat-resize-handle.tsx";
import { WelcomeIntro } from "./welcome-intro.tsx";
import { useWorkbenchState } from "./use-workbench-state.tsx";
import { WorkbenchStyles } from "./workbench-styles.tsx";
import { type ReactNode } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import { ChatContent, TooltipIconButton } from "../index.ts";
import { FileText, MessageSquare, Menu } from "lucide-react";
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
            <WorkbenchChatHeader
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
