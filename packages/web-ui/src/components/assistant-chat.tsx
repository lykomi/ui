import { type FC, useState, useRef, useCallback } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ErrorPrimitive,
  useAuiState,
  useComposerRuntime,
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
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { MarkdownText } from "./markdown-text.tsx";
import { ToolFallback } from "./tool-fallback.tsx";
import { LoadingIndicator, LoadingBar } from "./loading-indicator.tsx";

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
        <div className="flex items-center justify-end gap-2 pr-2">
          <BranchPicker />
          <div className="w-10 flex items-center justify-end">
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

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="w-full mb-2 group">
    <div className="mx-auto max-w-3xl px-4">
      <div className="text-foreground leading-relaxed flex flex-col gap-4">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
      </div>
      <MessageError />

      <div className="flex items-center gap-2 mt-1">
        <AssistantActionBar />
        <BranchPicker />
      </div>
    </div>
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning className="flex items-center gap-1 -ml-2">
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

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="mt-2 rounded-lg border border-destructive bg-destructive/10 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-destructive">Error:</span>
        <ErrorPrimitive.Message className="text-sm text-destructive" />
      </div>
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
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

/** Starter prompts shown on empty state. Customize these for your agent's capabilities. */
const STARTER_SUGGESTIONS = [
  "Show me a short document about Python",
  "Summarize what you can help me with here",
  "Draft a concise release note from bullet points",
];

const ScrollToBottomButton: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <Button
      variant="outline"
      size="icon"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md"
    >
      <ChevronDown className="size-4" />
    </Button>
  </ThreadPrimitive.ScrollToBottom>
);

const DropZone: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const composerRuntime = useComposerRuntime();

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
      for (const file of files) {
        await composerRuntime.addAttachment(file);
      }
    },
    [composerRuntime],
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
    </div>
  );
};

/**
 * Reusable chat content — used by ChatPage and ChatBubble.
 * Renders inside a ThreadPrimitive.Root context.
 */
export function ChatContent() {
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
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {STARTER_SUGGESTIONS.map((prompt) => (
                    <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send asChild>
                      <Button variant="outline" className="text-sm">
                        {prompt}
                      </Button>
                    </ThreadPrimitive.Suggestion>
                  ))}
                </div>
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.If empty={false}>
              <div className="mx-auto max-w-3xl px-4 pt-8">
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
          <ScrollToBottomButton />
        </div>

        <div className="shrink-0 bg-background">
          <ThreadPrimitive.If running={false}>
            <div className="border-t border-border" />
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <LoadingBar />
          </ThreadPrimitive.If>

          <div className="mx-auto max-w-3xl px-4 py-4">
            <ComposerPrimitive.Root
              className={cn(
                "flex flex-col gap-2",
                "rounded-3xl border border-input",
                "bg-background shadow-sm",
                "px-4 py-2",
                "focus-within:border-primary/50 focus-within:shadow-md",
                "transition-all duration-300",
              )}
            >
              <ComposerContextBadges />
              <ComposerPrimitive.Attachments components={composerAttachmentComponents} />
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-1 shrink-0">
                  <ComposerPrimitive.AddAttachment asChild>
                    <TooltipIconButton tooltip="Attach file" variant="ghost" className="shrink-0">
                      <Paperclip className="size-5" />
                    </TooltipIconButton>
                  </ComposerPrimitive.AddAttachment>
                  <ContextPins showPinButton />
                </div>
                <ComposerPrimitive.Input
                  autoFocus
                  placeholder="Message Assistant..."
                  rows={1}
                  className={cn(
                    "flex-1 bg-transparent",
                    "py-2 text-base",
                    "text-foreground outline-none",
                    "placeholder:text-muted-foreground",
                    "resize-none max-h-32",
                  )}
                />
                <ComposerActionButton />
              </div>
            </ComposerPrimitive.Root>
          </div>
        </div>
      </DropZone>
    </ThreadPrimitive.Root>
  );
}
