import { create } from "zustand";
import {
  agentStateStore,
  citationStore,
  streamingStatusStore,
  type StreamingStatus,
} from "@iloveagents/foundry-agent";

export type ChatRunStatus = "running" | "waiting" | "completed" | "failed" | "cancelled";
export interface ChatRun {
  threadId: string;
  conversationUrl?: string;
  title: string;
  pageLabel?: string;
  /** Navigation snapshot at run start, interpreted by the owning feature module. */
  contextMeta?: Record<string, unknown>;
  status: ChatRunStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  stop: () => void;
}

export const isChatRunActive = (run: ChatRun) =>
  run.status === "running" || run.status === "waiting";

/** Browser-session activity. Message persistence remains owned by the history adapter. */
export const useChatRuns = create<{
  foregroundId: string | null;
  runs: Record<string, ChatRun>;
  deletedThreads: Record<string, true>;
}>(() => ({ foregroundId: null, runs: {}, deletedThreads: {} }));

const agentStates = new Map<string, { state: unknown; patch?: unknown[] }>();

const appProjections = new Map<string, Record<string, unknown>>();
export function getChatStateSnapshot(threadId: string) {
  return { state: agentStates.get(threadId)?.state, projection: appProjections.get(threadId) };
}
export function retainChatProjection(threadId: string, projection: Record<string, unknown>) {
  appProjections.set(threadId, structuredClone(projection));
}

export function publishChatAgentState(threadId: string, state: unknown, patch?: unknown[]) {
  if (useChatRuns.getState().deletedThreads[threadId]) return;
  agentStates.set(threadId, { state, patch });
  if (isForegroundChat(threadId)) agentStateStore.getState().setAgentState(state, patch);
}

const signals = new Map<
  string,
  {
    streamingStatus: StreamingStatus;
    runStartedAt: number | null;
    lastSignalAt: number | null;
  }
>();

export function isForegroundChat(threadId: string) {
  const foreground = useChatRuns.getState().foregroundId;
  return foreground === null || foreground === threadId;
}

export function selectChatRun(threadId: string) {
  useChatRuns.setState({ foregroundId: threadId });
  citationStore.getState().selectThread(threadId);
  const stored = agentStates.get(threadId);
  if (stored) agentStateStore.getState().setAgentState(stored.state, stored.patch);
  else agentStateStore.getState().reset();
  streamingStatusStore.setState(
    signals.get(threadId) ?? {
      streamingStatus: { status: "idle" },
      runStartedAt: null,
      lastSignalAt: null,
    },
  );
}

/** Call after a successful conversation deletion so session activity cannot restore it. */
export function removeChatRun(threadId: string) {
  const run = useChatRuns.getState().runs[threadId];
  if (run && isChatRunActive(run)) run.stop();
  useChatRuns.setState((state) => {
    const runs = { ...state.runs };
    delete runs[threadId];
    return { runs, deletedThreads: { ...state.deletedThreads, [threadId]: true as const } };
  });
  citationStore.getState().clear(threadId);
  signals.delete(threadId);
  agentStates.delete(threadId);
  appProjections.delete(threadId);
  if (useChatRuns.getState().foregroundId === threadId) {
    agentStateStore.getState().reset();
    streamingStatusStore.setState({
      streamingStatus: { status: "idle" },
      runStartedAt: null,
      lastSignalAt: null,
    });
  }
}

export function beginChatRun(run: Omit<ChatRun, "status" | "startedAt">) {
  const startedAt = Date.now();
  useChatRuns.setState((s) => ({
    runs: {
      ...s.runs,
      [run.threadId]: { ...run, status: "running", startedAt },
    },
  }));
  signals.set(run.threadId, {
    streamingStatus: { status: "thinking" },
    runStartedAt: startedAt,
    lastSignalAt: startedAt,
  });
  touchChatRun(run.threadId);
}

export function touchChatRun(threadId: string, status?: StreamingStatus) {
  const previous = signals.get(threadId);
  if (!previous) return;
  const next = {
    ...previous,
    lastSignalAt: Date.now(),
    ...(status ? { streamingStatus: status } : {}),
  };
  signals.set(threadId, next);
  if (isForegroundChat(threadId)) streamingStatusStore.setState(next);
}

export function updateChatRun(threadId: string, status: ChatRunStatus, error?: string) {
  useChatRuns.setState((s) => {
    const run = s.runs[threadId];
    if (!run) return s;
    return {
      runs: {
        ...s.runs,
        [threadId]: {
          ...run,
          status,
          ...(error ? { error } : {}),
          ...(["completed", "failed", "cancelled"].includes(status)
            ? { finishedAt: Date.now() }
            : {}),
        },
      },
    };
  });
  if (status !== "running" && status !== "waiting") {
    signals.delete(threadId);
    if (isForegroundChat(threadId))
      streamingStatusStore.setState({
        streamingStatus: { status: "idle" },
        runStartedAt: null,
        lastSignalAt: null,
      });
  }
}

/** Browser tools need the conversation in front, so they cannot act on another chat's page. */
export async function waitForForegroundChat(threadId: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (isForegroundChat(threadId)) return;
  updateChatRun(threadId, "waiting");
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      unsubscribe();
      signal.removeEventListener("abort", aborted);
    };
    const aborted = () => {
      cleanup();
      reject(signal.reason ?? new DOMException("Stopped", "AbortError"));
    };
    const unsubscribe = useChatRuns.subscribe(() => {
      if (isForegroundChat(threadId)) {
        cleanup();
        resolve();
      }
    });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else if (isForegroundChat(threadId)) {
      cleanup();
      resolve();
    }
  });
  updateChatRun(threadId, "running");
}

export function warnBeforeChatUnload(event: BeforeUnloadEvent) {
  if (!Object.values(useChatRuns.getState().runs).some(isChatRunActive)) return;
  event.preventDefault();
  event.returnValue = "";
}

/** Dispose browser-owned runs when the authenticated runtime is torn down. */
export function disposeChatRuns() {
  for (const run of Object.values(useChatRuns.getState().runs)) {
    if (isChatRunActive(run)) run.stop();
  }
  signals.clear();
  agentStates.clear();
  appProjections.clear();
  citationStore.setState({ results: [], byThread: {}, threadId: null });
  useChatRuns.setState({ foregroundId: null, runs: {}, deletedThreads: {} });
  streamingStatusStore.setState({
    streamingStatus: { status: "idle" },
    runStartedAt: null,
    lastSignalAt: null,
  });
}
