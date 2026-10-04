import { TooltipIconButton } from "../index.ts";
import {
  SquarePen,
  PanelLeft,
  MessageSquare,
  Menu,
  MessagesSquare,
  LoaderCircle,
} from "lucide-react";
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
            tooltip={running ? "AI is working — expand chat" : "Expand chat"}
            className={buttonClass}
            aria-label={running ? "AI is working — expand chat" : "Expand chat"}
            onClick={() => setCollapsed(false)}
          >
            {running ? (
              <LoaderCircle
                size={18}
                className="animate-spin motion-reduce:animate-none text-primary"
              />
            ) : (
              <MessageSquare size={18} />
            )}
          </TooltipIconButton>
        ) : (
          <>
            <div className="min-w-0 flex-1 px-2 py-2">
              <div className="text-sm font-semibold">{showHistory ? "Chats" : "Chat"}</div>
            </div>
            <RunningChatsMenu onOpen={returnToChat} />
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
              <MessagesSquare size={18} />
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
        <div data-chat-rail data-chat-shortcuts className="flex flex-col items-center gap-1">
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
            <MessagesSquare size={18} />
          </TooltipIconButton>
        </div>
      )}
    </>
  );
}
