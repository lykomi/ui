import { processContextStore } from "./process/process-agent-context.ts";
import { useEffect, useState } from "react";
import { ChevronDown, FileText, Maximize2, TextCursorInput } from "lucide-react";
import { useAppStore } from "../lib/app-store.ts";
import { summarizeChatContext } from "../lib/chat-context-summary.ts";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover.tsx";
import { ChatContextDetailsSlot } from "./chat-slots.tsx";
import { ChatContextItems } from "./chat-context-items.tsx";
import { ConversationMemory, useConversationMemory } from "./conversation-memory.tsx";
import { usePagePin } from "./context-bar.tsx";
import { PinStateIcon } from "./pin-state-icon.tsx";

function readContext() {
  return summarizeChatContext(useAppStore.getState().getAgentState());
}

/** The displayed context and the agent request use the same projection. */
export function ChatContext({ centered = false }: { centered?: boolean }) {
  const [open, setOpen] = useState(false);
  const memory = useConversationMemory();
  const [context, setContext] = useState(readContext);
  const items = useAppStore((s) => s.contextItems);
  const { isPinned, toggle } = usePagePin();
  const selection = items.find((item) => item.key && item.persistence === "ephemeral");
  const detail = context.detail || selection?.label || "";
  const additionalCount = items.length - (selection && detail === selection.label ? 1 : 0);
  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readContext();
        setContext((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next,
        );
      });
    };
    const unsubscribe = useAppStore.subscribe(refresh);
    const unsubscribeProcess = processContextStore.subscribe(refresh);
    // Modules already track field/caret events. Read after those listeners,
    // rather than keeping a competing focus state inside the chat UI.
    const events = ["focusin", "pointerup", "input", "selectionchange"];
    for (const event of events) document.addEventListener(event, refresh);
    const handles =
      "[data-focused], [data-context-ref-type='entity-field'], [data-agent-component]";
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            if (
              records.some(
                (record) =>
                  record.type === "attributes" ||
                  (record.target instanceof Element && record.target.closest(handles)) ||
                  [...record.addedNodes, ...record.removedNodes].some(
                    (node) =>
                      node instanceof Element &&
                      (node.matches(handles) || node.querySelector(handles)),
                  ),
              )
            )
              refresh();
          });
    observer?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-agent-selected",
        "data-agent-component-label",
        "data-focused",
        "data-focus-title",
        "data-focus-kind",
        "data-context-ref-type",
        "data-context-ref-id",
        "data-entity-field-key",
        "data-entity-field-label",
        "inert",
        "hidden",
        "aria-hidden",
      ],
    });
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      unsubscribeProcess();
      observer?.disconnect();
      for (const event of events) document.removeEventListener(event, refresh);
    };
  }, []);
  const Icon = context.field ? TextCursorInput : context.focused ? Maximize2 : FileText;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-chat-context
          aria-label={`Message context: ${context.label}${detail ? `, ${detail}` : ""}${additionalCount ? `, ${additionalCount} more` : ""}${memory?.full ? ", conversation memory full" : memory?.nearlyFull ? ", conversation memory nearly full" : ""}`}
          className={`mb-2 flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary [@media(pointer:coarse)]:min-h-11 ${centered ? "mx-auto w-fit max-w-full" : "w-full"}`}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate" aria-live="polite">
            With <span className="font-medium text-foreground">{context.label}</span>
            {detail && (
              <>
                {" "}
                <span aria-hidden>›</span>{" "}
                <span className="font-medium text-foreground">{detail}</span>
              </>
            )}
          </span>
          {additionalCount > 0 && (
            <span className="shrink-0 tabular-nums" aria-hidden>
              +{additionalCount}
            </span>
          )}
          {memory?.nearlyFull && (
            <span
              data-memory-dot
              title="Conversation memory nearly full"
              className={`size-1.5 shrink-0 rounded-full ${memory.full ? "bg-destructive" : "bg-warning"}`}
            />
          )}
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={centered ? "center" : "start"}
        side="top"
        collisionPadding={12}
        aria-label="Context and actions"
        className="w-[22rem] max-w-[calc(100vw-1.5rem)] max-h-[min(36rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain space-y-3 p-3 text-sm"
      >
        <div className="px-2">
          <h2 className="text-xs font-medium text-muted-foreground">Current context</h2>
          <p className="mt-1 break-words font-medium">
            {context.label}
            {detail && ` › ${detail}`}
          </p>
        </div>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          {detail
            ? "This selection stays available when you move into chat."
            : "The current page follows your navigation. Select text or a field to work more specifically."}
        </p>
        {context.selectedText && (
          <blockquote className="max-h-32 overflow-y-auto border-l-2 border-border pl-3 text-xs">
            {context.selectedText}
          </blockquote>
        )}
        {!context.focused && context.label !== "Your spaces" && (
          <button
            type="button"
            aria-pressed={isPinned}
            onClick={toggle}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
          >
            <PinStateIcon pinned={isPinned} className="size-4 shrink-0 text-muted-foreground" />
            {isPinned ? "Unpin this page" : "Keep this page in context"}
          </button>
        )}
        {context.processes.map((process, index) => (
          <section
            key={index}
            className="border-t border-border px-2 pt-3 text-xs"
            aria-label="Process context"
          >
            <h3 className="font-medium">{process.label}</h3>
            <p className="mt-1 text-muted-foreground">
              Current: {process.current} · Viewing: {process.selected}
            </p>
          </section>
        ))}
        <ChatContextItems items={items} onNavigate={() => setOpen(false)} />
        <ChatContextDetailsSlot onDismiss={() => setOpen(false)} />
        {memory && <ConversationMemory usage={memory} />}
        {context.references.length > 0 && (
          <div className="border-t border-border px-2 pt-3 text-xs">
            <h3 className="font-medium">Also open</h3>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {context.references.map((label, index) => (
                <li key={`${label}-${index}`} className="truncate">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
