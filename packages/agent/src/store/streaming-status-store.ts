import { createStore } from "zustand/vanilla";

/** Streaming status emitted by the AG-UI runner. */
export interface StreamingStatus {
  status: "thinking" | "calling" | "streaming" | "idle";
  toolName?: string;
}

interface StreamingStatusState {
  streamingStatus: StreamingStatus;
  setStreamingStatus: (status: StreamingStatus) => void;
}

/**
 * Vanilla store for streaming status. Use `useStore(streamingStatusStore, ...)`
 * from the React entry of zustand for hook-style subscriptions.
 */
export const streamingStatusStore = createStore<StreamingStatusState>((set) => ({
  streamingStatus: { status: "idle" },
  setStreamingStatus: (streamingStatus) => set({ streamingStatus }),
}));
