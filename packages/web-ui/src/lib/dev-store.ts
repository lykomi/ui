/**
 * Dev Store — captures debug telemetry for the Dev Panel.
 *
 * Only populated in dev mode. Stores the last AG-UI request payload
 * and tool call events so developers can inspect the full agent turn.
 */

import { create } from "zustand";

export interface DevToolCall {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  isClientSide: boolean;
  timestamp: number;
}

interface DevState {
  /** Last AG-UI request payload (runInput) */
  lastRequest: Record<string, unknown> | null;
  /** Timestamp of last request */
  lastRequestAt: number | null;
  /** Tool calls from the current/last turn */
  toolCalls: DevToolCall[];
  /** SSE events log (last N) */
  events: Array<{ type: string; timestamp: number; data?: string }>;

  /** Capture a request payload (resets tool calls for new turn) */
  captureRequest: (payload: Record<string, unknown>) => void;
  /** Record a tool call */
  addToolCall: (call: DevToolCall) => void;
  /** Update a tool call with args and/or result */
  updateToolCall: (id: string, update: Partial<Pick<DevToolCall, "args" | "result">>) => void;
  /** Log an SSE event */
  logEvent: (type: string, data?: string) => void;
}

const MAX_EVENTS = 50;

export const useDevStore = create<DevState>((set, get) => ({
  lastRequest: null,
  lastRequestAt: null,
  toolCalls: [],
  events: [],

  captureRequest: (payload) => {
    const isFollowUp = get().toolCalls.length > 0;
    set({
      lastRequest: payload,
      lastRequestAt: Date.now(),
      // Keep tool calls for follow-up requests (multi-turn), reset on fresh turn
      ...(isFollowUp ? {} : { toolCalls: [], events: [] }),
    });
  },

  addToolCall: (call) => set({ toolCalls: [...get().toolCalls, call] }),

  updateToolCall: (id, update) =>
    set({
      toolCalls: get().toolCalls.map((tc) => (tc.id === id ? { ...tc, ...update } : tc)),
    }),

  logEvent: (type, data) => {
    const events = get().events;
    const next = [...events, { type, timestamp: Date.now(), data }];
    set({ events: next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next });
  },
}));
