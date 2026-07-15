import { createStore } from "zustand/vanilla";

/** Streaming status emitted by the AG-UI runner. */
export interface StreamingStatus {
  status: "thinking" | "calling" | "streaming" | "stalled" | "idle";
  toolName?: string;
}

interface StreamingStatusState {
  streamingStatus: StreamingStatus;
  /**
   * Wall-clock ms of the last signal proving the run is alive — any runner
   * event or a server heartbeat. `null` outside a run. Consumers use it to
   * distinguish "quietly working" from "pipe is dead".
   */
  lastSignalAt: number | null;
  /** Wall-clock ms when the active run started; `null` when idle. */
  runStartedAt: number | null;
  setStreamingStatus: (status: StreamingStatus) => void;
  /** Record liveness (runner event or server heartbeat arrived). */
  touchSignal: () => void;
  markRunStarted: () => void;
  markRunEnded: () => void;
}

/**
 * Vanilla store for streaming status. Use `useStore(streamingStatusStore, ...)`
 * from the React entry of zustand for hook-style subscriptions.
 */
export const streamingStatusStore = createStore<StreamingStatusState>((set) => ({
  streamingStatus: { status: "idle" },
  lastSignalAt: null,
  runStartedAt: null,
  setStreamingStatus: (streamingStatus) => set({ streamingStatus, lastSignalAt: Date.now() }),
  touchSignal: () => set({ lastSignalAt: Date.now() }),
  markRunStarted: () => set({ runStartedAt: Date.now(), lastSignalAt: Date.now() }),
  markRunEnded: () => set({ runStartedAt: null, lastSignalAt: null }),
}));
