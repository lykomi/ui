import { createStore } from "zustand/vanilla";

interface AgentStateState {
  /** Latest server-published agent state, or `null` before the first snapshot. */
  state: unknown;
  /** JSON Patch from the most recent `STATE_DELTA`, if the last update was one. */
  lastPatch: unknown[] | null;
  setAgentState: (state: unknown, patch?: unknown[]) => void;
  reset: () => void;
}

/**
 * Server-published agent state (AG-UI `STATE_SNAPSHOT` / `STATE_DELTA`).
 *
 * The AG-UI client already applies snapshots and JSON-Patch deltas to its
 * own internal state, but nothing surfaced that to the UI — a page could
 * only read it by reaching into the transport. This store is the seam:
 * the runner publishes each update, React consumers bind with
 * `useStore(agentStateStore, selector)`.
 *
 * Vanilla store — this package stays zero-React.
 */
export const agentStateStore = createStore<AgentStateState>((set) => ({
  state: null,
  lastPatch: null,
  setAgentState: (state, patch) => set({ state, lastPatch: patch ?? null }),
  reset: () => set({ state: null, lastPatch: null }),
}));
