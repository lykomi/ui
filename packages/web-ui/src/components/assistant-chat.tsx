import { type FC, useState, useRef, useCallback, useEffect } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ErrorPrimitive,
  useAui,
  useAuiState,
  useThreadViewport,
} from "@assistant-ui/react";
import {
  ArrowUp,
  Copy,
  Check,
  RefreshCw,
  PencilIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Square,
  Bot,
  Paperclip,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Button } from "@iloveagents/foundry-web-primitives";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { userAttachmentComponents, composerAttachmentComponents } from "./chat-attachments.tsx";
import { SentContextBadges, ComposerContextBadges } from "./context-badges.tsx";
import { ContextPins } from "./context-bar.tsx";
import { ComposerSubmitBridge } from "./composer-submit-bridge.tsx";
import { ChatComposerBannerSlot } from "./chat-slots.tsx";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { ReasoningEffortPicker } from "./reasoning-effort-picker.tsx";
import { ChatMessageParts } from "./chat-message-parts.tsx";
import { LoadingIndicator, LoadingBar } from "./loading-indicator.tsx";
import { MessageTimestamp } from "./message-timestamp.tsx";
import { MessageError } from "./message-error.tsx";

const BranchPicker: FC = () => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className="inline-flex items-center gap-1 text-xs"
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="Previous" size="icon">
        <ChevronLeft className="size-4" />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span className="text-muted-foreground">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="Next" size="icon">
        <ChevronRight className="size-4" />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);

const UserMessage: FC = () => {
  const messageId = useAuiState((s) => s.message.id);

  return (
    <MessagePrimitive.Root className="w-full mb-2 group">
      <div className="flex flex-col items-end gap-1">
        <MessagePrimitive.Attachments components={userAttachmentComponents} />
        <SentContextBadges messageId={messageId} />
        <div className={cn("max-w-[80%]", "bg-muted rounded-2xl", "px-4 py-3", "text-foreground")}>
          <MessagePrimitive.Content />
        </div>
        <div className="flex h-8 items-center justify-end gap-2 pr-2">
          <MessageTimestamp />
          <BranchPicker />
          <div className="flex h-8 w-10 items-center justify-end">
            <UserActionBar />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
  >
    <ActionBarPrimitive.Edit asChild>
      <TooltipIconButton tooltip="Edit" size="icon">
        <PencilIcon className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const AssistantMessage: FC = () => {
  // Until the message has parts there is nothing to copy, retry or branch.
  // `AssistantActionBar` already hides its BUTTONS while running, but the
  // row reserving their height did not — so an empty assistant message put
  // a 36px hole between the question and the "Thinking" line, which read as
  // the indicator floating far away from the message it belongs to.
  const hasParts = useAuiState(
    (s) => ((s.message.parts as unknown[] | undefined)?.length ?? 0) > 0,
  );

  return (
    <MessagePrimitive.Root className="w-full mb-2 group">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-foreground leading-relaxed flex flex-col gap-4">
          <ChatMessageParts />
        </div>
        <MessageError />

        {hasParts && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex h-8 w-[4.25rem] items-center">
              <AssistantActionBar />
            </div>
            <BranchPicker />
            <MessageTimestamp />
          </div>
        )}
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    className={cn(
      "pointer-events-none flex items-center gap-1 -ml-2 opacity-0 transition-opacity",
      "group-hover:pointer-events-auto group-hover:opacity-100",
      "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
    )}
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy" size="icon">
        <MessagePrimitive.If copied={false}>
          <Copy className="size-4" />
        </MessagePrimitive.If>
        <MessagePrimitive.If copied>
          <Check className="size-4 text-primary" />
        </MessagePrimitive.If>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Refresh" size="icon">
        <RefreshCw className="size-4" />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <MessagePrimitive.Root className="w-full mb-2">
    <div className="flex items-start justify-end">
      <div className="w-full max-w-[80%]">
        <ComposerPrimitive.Root
          className={cn(
            "flex flex-col gap-2",
            "rounded-2xl border border-input",
            "bg-background shadow-sm",
            "px-4 py-3",
          )}
        >
          <ComposerPrimitive.Input
            autoFocus
            className={cn(
              "w-full bg-transparent",
              "text-base text-foreground",
              "outline-none resize-none",
              "placeholder:text-muted-foreground",
            )}
          />
          <div className="flex items-center justify-end gap-2">
            <ComposerPrimitive.Cancel asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
              <Button size="sm">Update</Button>
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </div>
  </MessagePrimitive.Root>
);

const ComposerActionButton: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ReasoningEffortPicker />
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10 flex-shrink-0"
            aria-label="Stop generating"
          >
            <Square className="size-4" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            size="icon"
            className="rounded-full size-10 flex-shrink-0"
            aria-label="Send message"
          >
            <ArrowUp className="size-5" />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
    </>
  );
};

/**
 * Default starter prompts shown on empty state. Override per-app by passing
 * a `starterSuggestions` prop to `<ChatContent>`. An empty array (`[]`)
 * suppresses the suggestion buttons entirely.
 */
export const DEFAULT_STARTER_SUGGESTIONS = [
  "Say hello world",
  "What tools can you use?",
  "Help me get started",
];

const ScrollToBottomButton: FC = () => {
  const isAtBottom = useThreadViewport((s) => s.isAtBottom);
  const scrollToBottom = useThreadViewport((s) => s.scrollToBottom);

  if (isAtBottom) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md"
      onClick={() => scrollToBottom({ behavior: "smooth" })}
    >
      <ChevronDown className="size-4" />
    </Button>
  );
};

const DropZone: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const dropErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounter = useRef(0);
  const aui = useAui();

  const showDropError = useCallback((message: string) => {
    setDropError(message);
    if (dropErrorTimer.current) clearTimeout(dropErrorTimer.current);
    dropErrorTimer.current = setTimeout(() => setDropError(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (dropErrorTimer.current) clearTimeout(dropErrorTimer.current);
    };
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      // Drops bypass the file picker's ``accept`` filter, so the adapter's
      // add() is the real gate here — surface its rejections instead of
      // leaving an unhandled promise rejection and a silently missing chip.
      const rejected: string[] = [];
      for (const file of files) {
        try {
          await aui.composer.addAttachment(file);
        } catch (err) {
          rejected.push(
            `${file.name}: ${err instanceof Error ? err.message : "unsupported file type"}`,
          );
        }
      }
      if (rejected.length > 0) {
        showDropError(
          rejected.length === 1
            ? `Couldn't attach ${rejected[0]}`
            : `Couldn't attach ${rejected.length} files (${rejected.join("; ")})`,
        );
      }
    },
    [aui, showDropError],
  );

  return (
    <div
      className="relative flex flex-col flex-1 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center pointer-events-none",
            "bg-background/80 backdrop-blur-sm",
            "border-2 border-dashed border-primary rounded-xl",
          )}
        >
          <p className="text-lg text-primary font-medium">Drop files here</p>
        </div>
      )}
      {dropError && (
        <div
          role="alert"
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90%]",
            "rounded-md border border-destructive/50 bg-background px-3 py-2",
            "text-sm text-destructive shadow-md pointer-events-none truncate",
          )}
        >
          {dropError}
        </div>
      )}
    </div>
  );
};

export interface ChatContentProps {
  /**
   * Starter prompts shown when the thread is empty. Defaults to
   * `DEFAULT_STARTER_SUGGESTIONS`. Pass an empty array to hide the
   * suggestion buttons entirely. Downstream apps can pass a
   * workspace-aware list derived from app context.
   */
  starterSuggestions?: string[];
  /**
   * Show the page pin button in the composer.
   *
   * Defaults to TRUE. It defaulted to false, and nothing in the shell ever
   * passed it, so the affordance shipped switched off everywhere: on a
   * document or a view there was no way to put the thing you were looking
   * at into the conversation. Pinning the current page is the core gesture
   * of a page-aware chat, not an opt-in extra — an app that genuinely wants
   * a bare composer opts OUT.
   */
  showPinButton?: boolean;
}

/**
 * Reusable chat content — used by ChatPage and ChatBubble.
 * Renders inside a ThreadPrimitive.Root context.
 */
export function ChatContent({
  starterSuggestions = DEFAULT_STARTER_SUGGESTIONS,
  showPinButton = true,
}: ChatContentProps = {}) {
  const isExpanded = useChatBubbleStore((s) => s.isExpanded);
  const collapseChat = useChatBubbleStore((s) => s.collapse);
  const showPagePanel = useChatBubbleStore((s) => s.showPagePanel);
  const togglePagePanel = useChatBubbleStore((s) => s.togglePagePanel);

  return (
    <ThreadPrimitive.Root
      className={cn("flex flex-col flex-1", "bg-background text-foreground", "overflow-hidden")}
    >
      {/* Collapse header — only in expanded layout mode */}
      {isExpanded && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Chat
          </span>
          <div className="flex items-center gap-1">
            <TooltipIconButton
              tooltip={showPagePanel ? "Hide page panel" : "Show page panel"}
              size="icon"
              onClick={togglePagePanel}
              className="hidden xl:inline-flex"
            >
              {showPagePanel ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </TooltipIconButton>
            <TooltipIconButton tooltip="Minimize to bubble" size="icon" onClick={collapseChat}>
              <Minimize2 className="size-4" />
            </TooltipIconButton>
          </div>
        </div>
      )}
      <DropZone>
        <div className="relative flex-1 overflow-hidden">
          <ThreadPrimitive.Viewport className="absolute inset-0 overflow-y-auto bg-background">
            <ThreadPrimitive.Empty>
              <div
                className={cn("flex min-h-full flex-col", "items-center justify-center", "px-4")}
              >
                <Bot className="size-16 mb-6 text-primary/70" />
                <h1 className="text-[2rem] font-normal text-foreground text-center mb-6">
                  How can I help you today?
                </h1>
                {starterSuggestions.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                    {starterSuggestions.map((prompt) => (
                      <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send asChild>
                        <Button variant="outline" className="text-sm">
                          {prompt}
                        </Button>
                      </ThreadPrimitive.Suggestion>
                    ))}
                  </div>
                )}
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.If empty={false}>
              {/* `pb-4`: the column had padding at the top and none at the
                  bottom, so whatever came last in the thread sat flush against
                  the composer's edge. Most visible on the running status line,
                  which is a single short row and read as if it were part of
                  the input rather than part of the conversation — but the last
                  message had the same problem, quietly. */}
              <div className="mx-auto max-w-3xl px-4 pt-8 pb-4">
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage,
                    EditComposer,
                    AssistantMessage,
                  }}
                />
                <ThreadPrimitive.If running>
                  <LoadingIndicator />
                </ThreadPrimitive.If>
              </div>
            </ThreadPrimitive.If>
          </ThreadPrimitive.Viewport>
          <ThreadPrimitive.If empty={false}>
            <ScrollToBottomButton />
          </ThreadPrimitive.If>
        </div>

        <div className="shrink-0 bg-background">
          <ChatComposerBannerSlot />
          <ThreadPrimitive.If running={false}>
            <div className="border-t border-border" />
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <LoadingBar />
          </ThreadPrimitive.If>

          <div className="mx-auto max-w-3xl px-4 py-4">
            <ComposerPrimitive.Root
              className={cn(
                // Query container for the controls inside, so they size
                // against the composer rather than the viewport. This one
                // is wide, so the effort picker keeps its full label.
                "@container",
                "flex flex-col gap-2",
                "rounded-3xl border border-input",
                "bg-background shadow-sm",
                "px-4 py-2",
                "focus-within:border-primary/50 focus-within:shadow-md",
                "transition-all duration-300",
              )}
            >
              <ComposerSubmitBridge />
              <ComposerContextBadges />
              <ComposerPrimitive.Attachments components={composerAttachmentComponents} />
              {/* Text on its own row, controls in a dedicated bottom row.
                  With everything in ONE row, the trailing controls sit
                  vertically centered beside the input — fine for one line,
                  but wrapped text in a narrow window turns into a tall block
                  with the picker and Send floating mid-height next to it.
                  Splitting rows means text wraps freely across the full
                  width and the controls keep one stable, predictable line. */}
              <ComposerPrimitive.Input
                autoFocus
                placeholder="Message Assistant..."
                rows={1}
                className={cn(
                  "w-full bg-transparent",
                  "pt-2 text-base",
                  "text-foreground outline-none",
                  "placeholder:text-muted-foreground",
                  "resize-none max-h-32",
                )}
              />
              <div className="flex items-center gap-2 pb-1">
                <div className="flex items-center -space-x-1 shrink-0">
                  <ComposerPrimitive.AddAttachment asChild>
                    <TooltipIconButton tooltip="Attach file" variant="ghost" className="shrink-0">
                      <Paperclip className="size-5" />
                    </TooltipIconButton>
                  </ComposerPrimitive.AddAttachment>
                  <ContextPins showPinButton={showPinButton} />
                </div>
                <div className="flex-1" />
                <ComposerActionButton />
              </div>
            </ComposerPrimitive.Root>
          </div>
        </div>
      </DropZone>
    </ThreadPrimitive.Root>
  );
}
