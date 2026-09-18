import { useStore } from "zustand";
import { contextUsageStore } from "@iloveagents/foundry-agent";
import { Info } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.tsx";

import { useCurrentThreadId } from "./ag-ui-adapter-context.ts";

/** From here the chat is close to the point where older content is summarized. */
const NEARLY_FULL = 0.9;
/** At the ceiling: the next message compacts the chat. */
const FULL = 0.98;

export interface ConversationMemoryUsage {
  used: number;
  limit: number;
  ratio: number;
  nearlyFull: boolean;
  full: boolean;
}

function formatTokens(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * How much of this conversation's memory is in use, or `null` while unknown.
 *
 * Known only when a fill and its ceiling are both stated in the same units:
 * preferably by the server with each model call's usage, else the model's
 * input count against a window the host stated.
 */
export function useConversationMemory(): ConversationMemoryUsage | null {
  const threadId = useCurrentThreadId();
  const windowTokens = useStore(contextUsageStore, (s) => s.windowTokens);
  const usage = useStore(contextUsageStore, (s) => (threadId ? s.byThread[threadId] : undefined));
  if (!usage) return null;
  const used = usage.contextLimit ? (usage.contextUsed ?? 0) : usage.inputTokens;
  const limit = usage.contextLimit ?? windowTokens;
  if (!limit) return null;
  const ratio = Math.min(used / limit, 1);
  return {
    used: Math.min(used, limit),
    limit,
    ratio,
    nearlyFull: ratio >= NEARLY_FULL,
    full: ratio >= FULL,
  };
}

function explanation(usage: ConversationMemoryUsage): string {
  if (usage.full)
    return "This chat is full. It will be compacted with your next message: earlier parts are summarized to make room.";
  if (usage.nearlyFull)
    return "This chat is nearly full. When it fills, earlier parts are summarized to make room; for a fresh topic, start a new chat.";
  return "When this fills, the chat is compacted: earlier parts are summarized to make room.";
}

/** The "Conversation memory" section of the context card. */
export function ConversationMemory({ usage }: { usage: ConversationMemoryUsage }) {
  const percent = Math.round(usage.ratio * 100);
  const about = explanation(usage);
  return (
    <section
      aria-label="Conversation memory"
      data-conversation-memory={usage.full ? "full" : usage.nearlyFull ? "nearly-full" : "ok"}
      className="border-t border-border px-2 pt-3 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="font-medium">Conversation memory</h3>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={about}
                  className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-60 leading-relaxed">
                {about}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="tabular-nums text-muted-foreground">
          {formatTokens(usage.used)} of {formatTokens(usage.limit)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent}% of conversation memory used`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            usage.full ? "bg-destructive" : usage.nearlyFull ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}
