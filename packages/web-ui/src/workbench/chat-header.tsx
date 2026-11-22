import { TooltipIconButton } from "../index.ts";
import { Button } from "@lykomi/web-primitives";
import { SquarePen, MessageSquare, Menu, MessagesSquare } from "lucide-react";
import { useChatWidth } from "./use-chat-width.ts";
import { RunningChatsMenu } from "./running-chats-menu.tsx";
export function WorkbenchChatHeader({
  chatWidth,
  buttonClass,
  toggleNavigation,
  showHistory,
  startChat,
  returnToChat,
  openHistory,
  canResumeChat = false,
}: {
  chatWidth: ReturnType<typeof useChatWidth>;
  buttonClass: string;
  toggleNavigation: () => void;
  showHistory: boolean;
  startChat: () => void;
  returnToChat: () => void;
  openHistory: () => void;
  canResumeChat?: boolean;
}) {
  return (
    <>
      <div data-chat-header className="relative flex shrink-0 items-center gap-1 px-2">
        {!chatWidth.compact && (
          <TooltipIconButton
            tooltip="Open navigation"
            className={`${buttonClass} preview-mobile-navigation`}
            aria-label="Open navigation"
            onClick={toggleNavigation}
          >
            <Menu size={18} />
          </TooltipIconButton>
        )}
        <div className="min-w-0 flex-1 px-2 py-2">
          <div className="text-sm font-semibold">{showHistory ? "Chat history" : "Chat"}</div>
        </div>
        <RunningChatsMenu onOpen={returnToChat} />
        {showHistory && (
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
        {!showHistory && (
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
      </div>
    </>
  );
}
