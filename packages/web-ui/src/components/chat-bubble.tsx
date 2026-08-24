import { useRef, useState } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  useAuiState,
  useThreadViewport,
} from "@assistant-ui/react";
import {
  Sparkles,
  X,
  Maximize2,
  SquarePen,
  ArrowUp,
  Square,
  ChevronDown,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Button } from "@iloveagents/foundry-web-primitives";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { ContextPins } from "./context-bar.tsx";
import { ComposerContextBadges, SentContextBadges } from "./context-badges.tsx";
import { ComposerSubmitBridge } from "./composer-submit-bridge.tsx";
import { ComposerAddMenu } from "./composer-add-menu.tsx";
import { DEFAULT_COMPOSER_PLACEHOLDER } from "./assistant-chat.tsx";
import {
  ChatComposerActionsSlot,
  ChatComposerBannerSlot,
  ChatLauncherBadgeSlot,
  useComposerActionsOwnSend,
} from "./chat-slots.tsx";
import { ChatMessageParts } from "./chat-message-parts.tsx";
import { ReasoningEffortPicker } from "./reasoning-effort-picker.tsx";
import { LoadingIndicator } from "./loading-indicator.tsx";
import { MessageTimestamp } from "./message-timestamp.tsx";
import { MessageError } from "./message-error.tsx";
import { useAppStore } from "../lib/app-store.ts";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { useNewConversation } from "../lib/use-new-conversation.ts";
import { RAIL_WIDTH, useSidebarStore } from "../lib/sidebar-store.ts";

const CHAT_BUBBLE_INSET = 8;

function BubbleAssistantMessage() {
  return (
    <MessagePrimitive.Root className="w-full mb-2 group">
      <div className="text-foreground text-sm leading-relaxed flex flex-col gap-2">
        <ChatMessageParts />
      </div>
      <MessageError compact />
      <div className="flex h-7 items-center gap-2 mt-1">
        <ActionBarPrimitive.Root
          hideWhenRunning
          className={cn(
            "pointer-events-none flex items-center gap-1 opacity-0 transition-opacity",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          )}
        >
          <ActionBarPrimitive.Copy asChild>
            <TooltipIconButton tooltip="Copy" size="icon" className="size-7">
              <MessagePrimitive.If copied={false}>
                <Copy className="size-3" />
              </MessagePrimitive.If>
              <MessagePrimitive.If copied>
                <Check className="size-3 text-primary" />
              </MessagePrimitive.If>
            </TooltipIconButton>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <TooltipIconButton tooltip="Retry" size="icon" className="size-7">
              <RefreshCw className="size-3" />
            </TooltipIconButton>
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
        <MessageTimestamp />
      </div>
    </MessagePrimitive.Root>
  );
}

function BubbleUserMessage() {
  const messageId = useAuiState((s) => s.message.id);

  return (
    <MessagePrimitive.Root className="w-full mb-2">
      <div className="flex flex-col items-end gap-1">
        <SentContextBadges messageId={messageId} />
        <div className="max-w-[85%] bg-muted rounded-2xl px-3 py-2 text-sm text-foreground">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function BubbleScrollToBottomButton() {
  const isAtBottom = useThreadViewport((s) => s.isAtBottom);
  const scrollToBottom = useThreadViewport((s) => s.scrollToBottom);

  if (isAtBottom) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md size-7"
      onClick={() => scrollToBottom({ behavior: "smooth" })}
    >
      <ChevronDown className="size-3" />
    </Button>
  );
}

export function ChatBubble() {
  const isOpen = useChatBubbleStore((s) => s.isOpen);
  const isExpanded = useChatBubbleStore((s) => s.isExpanded);
  const openBubble = useChatBubbleStore((s) => s.open);
  const closeBubble = useChatBubbleStore((s) => s.close);
  const expandChat = useChatBubbleStore((s) => s.expand);
  const startNewThread = useNewConversation({ navigateToChat: false, preserveNavigation: true });
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const pageLabel = useAppStore((s) => s.navContext.label);
  const currentPage = useAppStore((s) => s.currentPage);
  const threadActive = useAppStore((s) => s.threadActive);
  // With nothing typed, a module-supplied control may hold the send corner.
  const actionsOwnSend = useComposerActionsOwnSend();

  // Draggable position: null = use default CSS anchored with equal left/bottom inset.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close and reset drag position so it reopens at the default spot
  const handleClose = () => {
    setDragPos(null);
    closeBubble();
  };

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start drag when clicking header buttons
    if ((e.target as HTMLElement).closest("button")) return;
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    // Capture the initial position so first pointer-move works correctly
    setDragPos({ x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const panel = panelRef.current;
    const panelW = panel?.offsetWidth ?? 380;
    const panelH = panel?.offsetHeight ?? 600;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    // Clamp within viewport so the panel can't be dragged fully off-screen
    const x = Math.max(0, Math.min(window.innerWidth - panelW, dragStart.current.px + dx));
    const y = Math.max(0, Math.min(window.innerHeight - panelH, dragStart.current.py + dy));
    setDragPos({ x, y });
  };

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onHeaderLostPointerCapture = () => {
    dragStart.current = null;
  };

  // Hide bubble on chat page (already full-screen) and in expanded mode
  if (currentPage === "/" || isExpanded) return null;

  return (
    <>
      {!isOpen && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed bottom-0 left-0 z-40 hidden md:block",
            "border-r border-sidebar-border",
            "bg-gradient-to-b from-sidebar/0 via-sidebar/88 to-sidebar/96",
            "supports-[backdrop-filter]:backdrop-blur",
          )}
          style={{
            width: isSidebarOpen ? sidebarWidth : RAIL_WIDTH,
            height: 64,
          }}
        />
      )}

      {/* Trigger button — bottom-left corner. The positioned `group` wrapper
          is the anchor contract for ChatLauncherBadgeSlot: badges position
          absolutely over the button and may use group-hover for a flyout. */}
      {!isOpen && (
        <div
          className="fixed z-50 group"
          style={{ left: CHAT_BUBBLE_INSET, bottom: CHAT_BUBBLE_INSET }}
        >
          <button
            type="button"
            onClick={openBubble}
            className={cn(
              "size-10 rounded-full",
              "bg-primary text-primary-foreground shadow-lg",
              "flex items-center justify-center",
              "hover:bg-primary/90 transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label="Ask the AI"
          >
            <Sparkles className="size-4" />
          </button>
          <ChatLauncherBadgeSlot />
        </div>
      )}

      {/* Chat panel — draggable, anchored bottom-left by default */}
      {isOpen && (
        <div
          ref={panelRef}
          data-chat-surface="bubble"
          className={cn(
            "fixed z-50",
            "rounded-2xl border border-border",
            "bg-background shadow-2xl",
            "flex flex-col overflow-hidden",
            "w-95 h-150",
          )}
          style={
            dragPos
              ? { left: dragPos.x, top: dragPos.y }
              : { left: CHAT_BUBBLE_INSET, bottom: CHAT_BUBBLE_INSET }
          }
        >
          {/* Header — drag handle */}
          <div
            className={cn(
              "flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0",
              "cursor-grab active:cursor-grabbing select-none",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onLostPointerCapture={onHeaderLostPointerCapture}
          >
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-sm">
                <Sparkles className="size-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">{pageLabel}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {threadActive ? "Active thread" : "New conversation"}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <TooltipIconButton
                tooltip="New Thread"
                size="icon"
                className="size-7"
                onClick={startNewThread}
              >
                <SquarePen className="size-3.5" />
              </TooltipIconButton>
              <TooltipIconButton
                tooltip="Expand chat"
                size="icon"
                className="size-7"
                onClick={expandChat}
              >
                <Maximize2 className="size-3.5" />
              </TooltipIconButton>
              <TooltipIconButton
                tooltip="Close"
                size="icon"
                className="size-7"
                onClick={handleClose}
              >
                <X className="size-4" />
              </TooltipIconButton>
            </div>
          </div>

          {/* Thread */}
          <ThreadPrimitive.Root className="flex flex-col flex-1 overflow-hidden">
            <div className="relative flex-1 overflow-hidden">
              <ThreadPrimitive.Viewport className="absolute inset-0 overflow-y-auto">
                <ThreadPrimitive.Empty>
                  <div className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Ask the agent about this page
                    </p>
                  </div>
                </ThreadPrimitive.Empty>

                <ThreadPrimitive.If empty={false}>
                  {/* pb: the last thing in the scroller is often the running
                      status ("Thinking"), and with no bottom padding it sat
                      directly on the composer's top border. */}
                  <div className="px-4 pt-4 pb-3">
                    <ThreadPrimitive.Messages
                      components={{
                        UserMessage: BubbleUserMessage,
                        AssistantMessage: BubbleAssistantMessage,
                      }}
                    />
                    <ThreadPrimitive.If running>
                      <LoadingIndicator />
                    </ThreadPrimitive.If>
                  </div>
                </ThreadPrimitive.If>
              </ThreadPrimitive.Viewport>
              <ThreadPrimitive.If empty={false}>
                <BubbleScrollToBottomButton />
              </ThreadPrimitive.If>
            </div>

            {/* Composer — same pattern as full chat: attachment + input + send */}
            <div className="shrink-0 border-t border-border">
              <ChatComposerBannerSlot />
              <div className="px-3 py-3">
                <ComposerPrimitive.Root
                className={cn(
                  // Query container for the controls inside: the bubble is
                  // a narrow panel in a wide window, so they have to size
                  // against THIS box, not the viewport.
                  "@container",
                  "flex flex-col gap-1",
                  "rounded-2xl border border-input",
                  "bg-background shadow-sm",
                  "px-3 py-2",
                  "focus-within:border-primary/50",
                  "transition-all duration-200",
                )}
              >
                <ComposerSubmitBridge />
                <ComposerContextBadges />
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 items-center gap-0.5">
                    {/* The bubble is the chat you use WHILE reading a
                        document, so it needs the pin at least as much as
                        the expanded composer does — it just lives in the
                        menu now rather than owning a permanent icon. */}
                    <ComposerAddMenu compact />
                    <ContextPins compact />
                  </div>
                  <ComposerPrimitive.Input
                    autoFocus
                    placeholder={DEFAULT_COMPOSER_PLACEHOLDER}
                    rows={1}
                    className={cn(
                      "flex-1 bg-transparent",
                      "py-1 text-sm",
                      "text-foreground outline-none",
                      "placeholder:text-muted-foreground",
                      "resize-none max-h-20",
                    )}
                  />
                  {/* Right-hand slot, mirroring the expanded composer:
                      settings sit beside Send, not among the attachment
                      icons. Hidden while running, like the expanded one. */}
                  <ThreadPrimitive.If running={false}>
                    <ReasoningEffortPicker />
                  </ThreadPrimitive.If>
                  <ChatComposerActionsSlot />
                  <ThreadPrimitive.If running>
                    <ComposerPrimitive.Cancel asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full size-8 shrink-0"
                        aria-label="Stop"
                      >
                        <Square className="size-3" />
                      </Button>
                    </ComposerPrimitive.Cancel>
                  </ThreadPrimitive.If>
                  {!actionsOwnSend && (
                    <ThreadPrimitive.If running={false}>
                      <ComposerPrimitive.Send asChild>
                        <Button
                          size="icon"
                          className="rounded-full size-8 shrink-0"
                          aria-label="Send"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                      </ComposerPrimitive.Send>
                    </ThreadPrimitive.If>
                  )}
                </div>
                </ComposerPrimitive.Root>
              </div>
            </div>
          </ThreadPrimitive.Root>
        </div>
      )}
    </>
  );
}
