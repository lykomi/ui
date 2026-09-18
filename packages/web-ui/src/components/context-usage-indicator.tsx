import { useStore } from "zustand";
import { contextUsageStore } from "@iloveagents/foundry-agent";
import { cn } from "@iloveagents/foundry-web-primitives";

import { useCurrentThreadId } from "./ag-ui-adapter-context.ts";

/** From here the ring warns: the chat is close to where older content gets shortened. */
const WARN_AT = 0.8;
const FULL_AT = 0.95;
const SIZE = 16;
const STROKE = 2;

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
 * Drawn only when both facts are known: the size of the latest model call
 * (reported by the server for every call) and how much the chat can hold
 * (stated by the backend). Missing either, it renders nothing — a ring
 * against a guessed ceiling looks exact and is not.
 */
export function ContextUsageIndicator({ className }: { className?: string }) {
  const threadId = useCurrentThreadId();
  const windowTokens = useStore(contextUsageStore, (s) => s.windowTokens);
  const usage = useStore(contextUsageStore, (s) => (threadId ? s.byThread[threadId] : undefined));

  if (!windowTokens || !usage) return null;

  const ratio = Math.min(usage.inputTokens / windowTokens, 1);
  const percent = Math.round(ratio * 100);
  const state = ratio >= FULL_AT ? "full" : ratio >= WARN_AT ? "warn" : "ok";
  const detail =
    state === "ok"
      ? ""
      : state === "warn"
        ? " Older parts of this chat will soon be shortened; a new chat keeps answers sharp."
        : " Older parts of this chat are being shortened to fit. Start a new chat for a fresh topic.";
  const label = `Context ${percent}% used (${formatTokens(usage.inputTokens)} of ${formatTokens(windowTokens)} tokens).${detail}`;

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
        state === "ok" && "text-muted-foreground",
        state === "warn" && "text-warning",
        state === "full" && "text-destructive",
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
          strokeOpacity={0.25}
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
