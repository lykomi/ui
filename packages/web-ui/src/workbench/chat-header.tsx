import { ChatPanelToggle } from "./chat-panel-toggle.tsx";
import { TooltipIconButton } from "../index.ts";
import { Button } from "@lykomi/web-primitives";
import { SquarePen, PanelLeft, MessageSquare, Menu, MessagesSquare } from "lucide-react";
import { useChatWidth } from "./use-chat-width.ts";
import { RunningChatsMenu } from "./running-chats-menu.tsx";
export function WorkbenchChatHeader({
  collapsed,
  running,
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
  home = false,
  canResumeChat = false,
}: {
  collapsed: boolean;
  running: boolean;
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
  home?: boolean;
  canResumeChat?: boolean;
}) {
  return (
    <>
      <div
        data-chat-header
        className={`relative flex shrink-0 items-center ${collapsed ? "justify-center" : "gap-1 px-2"}`}
      >
        {!collapsed && (!chatWidth.compact || chatOnly) && (
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
          <ChatPanelToggle running={running} home={home} onOpen={() => setCollapsed(false)} />
        ) : (
          <>
            <div className="min-w-0 flex-1 px-2 py-2">
              <div className="text-sm font-semibold">{showHistory ? "Chat history" : "Chat"}</div>
            </div>
            <RunningChatsMenu onOpen={returnToChat} />
            {showHistory && (canResumeChat || !chatOnly) && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={returnToChat}
              >
                <MessageSquare size={16} aria-hidden />
                {canResumeChat ? "Resume chat" : "Chat"}
              </Button>
            )}
            {!showHistory && canResumeChat && (
              <TooltipIconButton
                tooltip="Chat history"
                aria-label="Chat history"
                className={buttonClass}
                onClick={openHistory}
              >
                <MessagesSquare size={18} />
              </TooltipIconButton>
            )}
            <TooltipIconButton
              tooltip="New chat"
              className={buttonClass}
              aria-label="New chat"
              onClick={startChat}
            >
              <SquarePen size={18} />
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
    </>
  );
}
