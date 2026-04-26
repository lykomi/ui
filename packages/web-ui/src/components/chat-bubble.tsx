import { useRef, useState } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react";
import {
  MessageSquare,
  X,
  Maximize2,
  ArrowUp,
  Square,
  ChevronDown,
  Copy,
  Check,
  Paperclip,
} from "lucide-react";
import { cn } from "@lastspace/web-primitives";
import { Button } from "@lastspace/web-primitives";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { ContextPins } from "./context-bar.tsx";
import { ComposerContextBadges } from "./context-badges.tsx";
import { MarkdownText } from "./markdown-text.tsx";
import { LoadingIndicator } from "./loading-indicator.tsx";
import { useAppStore } from "../lib/app-store.ts";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { RAIL_WIDTH, useSidebarStore } from "../lib/sidebar-store.ts";

const CHAT_BUBBLE_INSET = 8;

function BubbleAssistantMessage() {
  return (
    <MessagePrimitive.Root className="w-full mb-2 group">
      <div className="text-foreground text-sm leading-relaxed flex flex-col gap-2">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
          }}
        />
      </div>
      <div className="flex items-center gap-1 mt-1">
        <ActionBarPrimitive.Root hideWhenRunning className="flex items-center gap-1">
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
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function BubbleUserMessage() {
  return (
    <MessagePrimitive.Root className="w-full mb-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-muted rounded-2xl px-3 py-2 text-sm text-foreground">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

export function ChatBubble() {
  const isOpen = useChatBubbleStore((s) => s.isOpen);
  const isExpanded = useChatBubbleStore((s) => s.isExpanded);
  const openBubble = useChatBubbleStore((s) => s.open);
  const closeBubble = useChatBubbleStore((s) => s.close);
  const expandChat = useChatBubbleStore((s) => s.expand);
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const pageLabel = useAppStore((s) => s.navContext.label);
  const currentPage = useAppStore((s) => s.currentPage);
  const threadActive = useAppStore((s) => s.threadActive);

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

      {/* Trigger button — bottom-left corner */}
      {!isOpen && (
        <button
          type="button"
          onClick={openBubble}
          className={cn(
            "fixed bottom-4 z-50",
            "size-10 rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "flex items-center justify-center",
            "hover:bg-primary/90 transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          style={{ left: CHAT_BUBBLE_INSET, bottom: CHAT_BUBBLE_INSET }}
          aria-label="Open chat"
        >
          <MessageSquare className="size-4" />
        </button>
      )}

      {/* Chat panel — draggable, anchored bottom-left by default */}
      {isOpen && (
        <div
          ref={panelRef}
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
                <MessageSquare className="size-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">{pageLabel}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {threadActive ? "Active thread" : "New conversation"}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
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
                  <div className="px-4 pt-4">
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
                <ThreadPrimitive.ScrollToBottom asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md size-7"
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                </ThreadPrimitive.ScrollToBottom>
              </ThreadPrimitive.If>
            </div>

            {/* Composer — same pattern as full chat: clip + pin + input + send */}
            <div className="shrink-0 border-t border-border px-3 py-3">
              <ComposerPrimitive.Root
                className={cn(
                  "flex flex-col gap-1",
                  "rounded-2xl border border-input",
                  "bg-background shadow-sm",
                  "px-3 py-2",
                  "focus-within:border-primary/50",
                  "transition-all duration-200",
                )}
              >
                <ComposerContextBadges />
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1 shrink-0">
                    <ComposerPrimitive.AddAttachment asChild>
                      <TooltipIconButton
                        tooltip="Attach file"
                        size="icon"
                        className="size-7 shrink-0"
                      >
                        <Paperclip className="size-3.5" />
                      </TooltipIconButton>
                    </ComposerPrimitive.AddAttachment>
                    <ContextPins compact showPinButton />
                  </div>
                  <ComposerPrimitive.Input
                    autoFocus
                    placeholder="Message..."
                    rows={1}
                    className={cn(
                      "flex-1 bg-transparent",
                      "py-1 text-sm",
                      "text-foreground outline-none",
                      "placeholder:text-muted-foreground",
                      "resize-none max-h-20",
                    )}
                  />
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
                </div>
              </ComposerPrimitive.Root>
            </div>
          </ThreadPrimitive.Root>
        </div>
      )}
    </>
  );
}
