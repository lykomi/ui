import { useStore } from "zustand";
import { streamingStatusStore } from "@iloveagents/foundry-agent";

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
 * phase, plus a distinct amber "stalled" treatment when no event or server
 * heartbeat has arrived for a while — so a user can always tell "still
 * working" from "connection is dead". A dead stream is additionally
 * surfaced as an explicit run error by the runner; this indicator covers
 * the in-flight phases.
 */
export function LoadingIndicator() {
  const streaming = useStore(streamingStatusStore, (s) => s.streamingStatus);

  const stalled = streaming.status === "stalled";
  let label = "Thinking";
  if (stalled) {
    label = "Still working — no signal from the agent";
  } else if (streaming.status === "calling" && streaming.toolName) {
    label = `Running ${formatToolName(streaming.toolName)}`;
  } else if (streaming.status === "streaming") {
    label = "Generating response";
  }

  return (
    // `px-4` keeps the label on the same left edge as the message parts
    // above it — measured, not guessed: the rows sit at x=469 and so does
    // this. The old `h-10` did NOT belong: a fixed 40px block on top of the
    // parts' own gap-4 left a visible hole under the last tool row.
    <div role="status" aria-live="polite" className="min-h-6 px-4">
      <div className="flex items-center gap-2 py-0.5 text-foreground leading-relaxed animate-in fade-in duration-300">
        <span className={stalled ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
          {label}
        </span>
        {/* One pulsing dot. Three read as a typing indicator borrowed from a
            messaging app; a single beat says "working" without the mimicry. */}
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${stalled ? "bg-warning/70" : "bg-primary/60"} animate-[pulse_1.4s_ease-in-out_infinite]`}
        />
      </div>
    </div>
  );
}
