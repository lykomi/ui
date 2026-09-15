import { ChatEmptyState } from "./chat-empty-state.tsx";
import { useAppStore } from "../lib/app-store.ts";
import { type CSSProperties } from "react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import { X, PanelLeft, MessageSquare } from "lucide-react";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { FocusPaneResize } from "./data-table/focus-pane-resize.tsx";
import { ChatContent } from "./assistant-chat.tsx";
export function FocusChatPane({
  chatOpen,
  setChatOpen,
  chatWidth,
  setChatWidth,
  source,
  onClose,
}: {
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  chatWidth?: number;
  setChatWidth: (v?: number) => void;
  source: boolean;
  onClose: () => void;
}) {
  const pageLabel = useAppStore((state) => state.navContext.label);
  return (
    <aside
      aria-label="Focused content chat"
      style={{ "--focus-chat-width": `${chatWidth ?? 384}px` } as CSSProperties}
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col border-r border-border bg-background",
        chatOpen ? "w-full md:w-[var(--focus-chat-width)]" : "w-11",
        source && "hidden xl:flex",
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center",
          chatOpen ? "gap-1 border-b border-border px-2" : "justify-center",
        )}
      >
        {chatOpen ? (
          <>
            <span className="min-w-0 flex-1 px-2 text-sm font-semibold">Chat</span>
            <TooltipIconButton
              tooltip="Collapse chat"
              aria-label="Collapse chat"
              className="size-8"
              onClick={() => setChatOpen(false)}
            >
              <PanelLeft size={18} />
            </TooltipIconButton>
            <Button
              variant="ghost"
              size="icon"
              title="Close"
              aria-label="Close"
              className="size-8 md:hidden"
              onClick={() => onClose()}
            >
              <X size={18} />
            </Button>
          </>
        ) : (
          <TooltipIconButton
            tooltip="Expand chat"
            aria-label="Expand chat"
            aria-expanded={false}
            className="size-8"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare size={18} />
          </TooltipIconButton>
        )}
      </div>
      {chatOpen && (
        <FocusPaneResize label="chat" side="right" width={chatWidth} onResize={setChatWidth} />
      )}
      {chatOpen && (
        <ChatContent
          emptyState={<ChatEmptyState pageLabel={pageLabel} homeStarterPriority={20} />}
          compactComposer
          starterSuggestions={[]}
        />
      )}
    </aside>
  );
}
