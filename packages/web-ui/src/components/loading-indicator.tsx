import { useStore } from "zustand";
import { useEffect, useState } from "react";
import { streamingStatusStore } from "@lykomi/agent";

function formatToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shimmer bar shown above the composer while the agent is running. */
export function LoadingBar() {
  return (
    <div className="w-full h-px bg-primary/30 overflow-hidden">
      <div className="h-full w-1/4 bg-primary animate-[shimmer_1.5s_ease-in-out_infinite]" />
    </div>
  );
}

/**
 * Inline status shown in the message area while the agent is running.
 *
 * Visible for the whole run (assistant-ui `running` gate) with the current
 * phase and elapsed time. Silence alone is not a connection failure;
 * confirmed transport errors are surfaced by the runner separately.
 */
export function LoadingIndicator() {
  const streaming = useStore(streamingStatusStore, (s) => s.streamingStatus);
  const startedAt = useStore(streamingStatusStore, (s) => s.runStartedAt);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const seconds = startedAt === null ? null : Math.max(0, Math.floor((now - startedAt) / 1000));

  let label = "Thinking";
  if (streaming.status === "calling" && streaming.toolName) {
    label = `Running ${formatToolName(streaming.toolName)}`;
  } else if (streaming.status === "streaming") {
    label = "Generating response";
  } else if (streaming.status === "working" && streaming.label) {
    label = streaming.label;
  }

  return (
    // `px-4` keeps the label on the same left edge as the message parts
    // above it — measured, not guessed: the rows sit at x=469 and so does
    // this. The old `h-10` did NOT belong: a fixed 40px block on top of the
    // parts' own gap-4 left a visible hole under the last tool row.
    <div role="status" aria-live="polite" className="min-h-6 px-4">
      <div className="flex items-center gap-2 py-0.5 text-foreground leading-relaxed animate-in fade-in duration-300">
        <span className="text-xs text-muted-foreground">{label}</span>
        {seconds !== null && (
          <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        )}
        {/* One pulsing dot. Three read as a typing indicator borrowed from a
            messaging app; a single beat says "working" without the mimicry. */}
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-primary/60 animate-[pulse_1.4s_ease-in-out_infinite]"
        />
      </div>
    </div>
  );
}
