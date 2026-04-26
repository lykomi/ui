import { useStore } from "zustand";
import { streamingStatusStore } from "@lastspace/agent";

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

/** Inline status text shown in the message area while the agent is running. */
export function LoadingIndicator() {
  const streaming = useStore(streamingStatusStore, (s) => s.streamingStatus);

  let label = "Thinking";
  if (streaming.status === "calling" && streaming.toolName) {
    label = `Running ${formatToolName(streaming.toolName)}`;
  } else if (streaming.status === "streaming") {
    label = "Generating response";
  }

  return (
    <div className="h-10 px-4">
      <div className="flex items-center gap-2 py-2 text-foreground leading-relaxed animate-in fade-in duration-300">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-primary/60 animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="size-1.5 rounded-full bg-primary/60 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}
