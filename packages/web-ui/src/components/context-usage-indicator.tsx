import { useStore } from "zustand";
import { contextUsageStore } from "@iloveagents/foundry-agent";
import { cn } from "@iloveagents/foundry-web-primitives";

import { useCurrentThreadId } from "./ag-ui-adapter-context.ts";

/**
 * Quiet until it matters. Most chats never come near the ceiling, and a
 * permanent gauge beside Send reads as a control (or a record button) and
 * competes with the composer for no reason. It appears muted at SHOW_AT and
 * takes the warning colour at WARN_AT — never destructive: nothing has
 * failed, older content is just being shortened.
 */
const SHOW_AT = 0.7;
const WARN_AT = 0.9;
const SIZE = 14;
const STROKE = 1.5;

function formatTokens(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * How full this conversation is, as a small ring beside the composer's
 * settings — the same cue other assistants give before a long chat starts
 * to lose its beginning.
 *
 * Drawn only when both a fill and its ceiling are known, in the same units:
 * preferably as the server states them with each model call's usage, else
 * the model's input count against a window the host stated. Missing either,
 * it renders nothing — a ring against a guessed ceiling looks exact and is
 * not.
 */
export function ContextUsageIndicator({ className }: { className?: string }) {
  const threadId = useCurrentThreadId();
  const windowTokens = useStore(contextUsageStore, (s) => s.windowTokens);
  const usage = useStore(contextUsageStore, (s) => (threadId ? s.byThread[threadId] : undefined));

  if (!usage) return null;
  // The server's own fill and ceiling when it states them (same units);
  // otherwise the model's input count against a window the host stated.
  const used = usage.contextLimit ? (usage.contextUsed ?? 0) : usage.inputTokens;
  const limit = usage.contextLimit ?? windowTokens;
  if (!limit) return null;

  const ratio = Math.min(used / limit, 1);
  if (ratio < SHOW_AT) return null;
  const percent = Math.round(ratio * 100);
  const state = ratio >= WARN_AT ? "warn" : "near";
  const detail =
    state === "near"
      ? " Older parts will be shortened once it fills; a new chat keeps answers sharp."
      : " Older parts of this chat are being shortened to fit. Start a new chat for a fresh topic.";
  const label = `Context ${percent}% used (${formatTokens(Math.min(used, limit))} of ${formatTokens(limit)} tokens).${detail}`;

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-context-usage={state}
      className={cn(
        "flex items-center rounded-md px-1 py-1",
        state === "near" && "text-muted-foreground/70",
        state === "warn" && "text-warning",
        className,
      )}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
    </span>
  );
}
