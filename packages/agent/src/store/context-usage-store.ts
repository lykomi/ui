import { createStore } from "zustand/vanilla";

/** What the most recent model call of a thread was sent and produced. */
export interface ContextUsage {
  /** Tokens the model received on its latest call — the conversation's current size. */
  inputTokens: number;
  outputTokens: number | null;
  /** The server's fill and ceiling in its own units, when it states them. */
  contextUsed: number | null;
  contextLimit: number | null;
  /** When it was recorded (epoch ms). */
  at: number;
}

interface ContextUsageState {
  /**
   * How many input tokens a chat can hold, or `null` while unknown.
   *
   * Set by the host app from the backend, never assumed here: a ring drawn
   * against a guessed window reads as precise and is simply wrong. Left
   * unset, nothing is shown.
   */
  windowTokens: number | null;
  /** Latest usage per thread id. */
  byThread: Record<string, ContextUsage>;
  setWindow: (windowTokens: number | null) => void;
  record: (
    threadId: string,
    usage: {
      inputTokens: number;
      outputTokens?: number | null;
      contextUsed?: number | null;
      contextLimit?: number | null;
    },
  ) => void;
}

/**
 * How full each conversation is.
 *
 * The server reports token usage for every model call; the runner surfaces
 * it as a `usage` event and the chat adapter records it here against the
 * thread. The latest call's input size is the conversation's size, since
 * every call carries the whole transcript.
 */
export const contextUsageStore = createStore<ContextUsageState>()((set) => ({
  windowTokens: null,
  byThread: {},
  setWindow: (windowTokens) =>
    set({
      windowTokens:
        typeof windowTokens === "number" && Number.isFinite(windowTokens) && windowTokens > 0
          ? windowTokens
          : null,
    }),
  record: (threadId, usage) =>
    set((state) => ({
      byThread: {
        ...state.byThread,
        [threadId]: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens ?? null,
          contextUsed: usage.contextUsed ?? null,
          contextLimit: usage.contextLimit ?? null,
          at: Date.now(),
        },
      },
    })),
}));
