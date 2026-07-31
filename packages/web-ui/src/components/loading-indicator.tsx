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
    <div className="h-10 px-4">
      <div className="flex items-center gap-2 py-2 text-foreground leading-relaxed animate-in fade-in duration-300">
        <span className={stalled ? "text-sm text-warning" : "text-sm text-muted-foreground"}>
          {label}
        </span>
        <div className="flex gap-1">
          <span
            className={`size-1.5 rounded-full ${stalled ? "bg-warning/70" : "bg-primary/60"} animate-[pulse_1.4s_ease-in-out_infinite]`}
          />
          <span
            className={`size-1.5 rounded-full ${stalled ? "bg-warning/70" : "bg-primary/60"} animate-[pulse_1.4s_ease-in-out_0.2s_infinite]`}
          />
          <span
            className={`size-1.5 rounded-full ${stalled ? "bg-warning/70" : "bg-primary/60"} animate-[pulse_1.4s_ease-in-out_0.4s_infinite]`}
          />
        </div>
      </div>
    </div>
  );
}
