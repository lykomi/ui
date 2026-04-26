import { create } from "zustand";

/** Streaming status emitted by the AG-UI adapter. */
export interface StreamingStatus {
  status: "thinking" | "calling" | "streaming" | "idle";
  toolName?: string;
}

/** Store for streaming status — written by the adapter, read by LoadingIndicator. */
export const useStreamingStatusStore = create<{
  streamingStatus: StreamingStatus;
  setStreamingStatus: (status: StreamingStatus) => void;
}>((set) => ({
  streamingStatus: { status: "idle" },
  setStreamingStatus: (streamingStatus) => set({ streamingStatus }),
}));
