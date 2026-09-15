import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  useEffect,
} from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import type { ThreadHistoryAdapter } from "@assistant-ui/react";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { AGUIAdapterSDK } from "../lib/ag-ui-adapter.ts";
import { FileAttachmentAdapter } from "../lib/attachment-adapter.ts";
import { useAttachmentAdapterStore } from "../lib/attachment-registry.ts";
import { useVoiceAdapterStore } from "../lib/voice-adapter-registry.ts";
import { ShowDocumentToolUI } from "./show-document-tool-ui.tsx";
import { ClientToolExecutor } from "./client-tool-executor.tsx";

/**
 * Per-mount inputs the host shell passes when it wants a chat
 * conversation history wired to the runtime. Mirrors
 * :type:`ChatConversationFactoryArgs` in ``foundry-web-shell`` —
 * duplicated here (rather than imported) so the web-ui package stays
 * independent of the shell package's dependency graph.
 */
export interface AGUIChatConversationFactoryArgs {
  /** Conversation id captured from the URL (resumed chat) or undefined (fresh). */
  urlMatch?: string;
  /** Stable AG-UI adapter thread id — present in both cases. */
  aguiThreadId: string;
}

/**
 * Factory the consumer passes to build a :type:`ThreadHistoryAdapter`
 * once the AG-UI adapter has minted its thread id. Called inside the
 * keyed runtime mount; assistant-ui invokes ``load()``/``append()``
 * via the returned adapter.
 */
export type AGUIHistoryAdapterFactory = (
  args: AGUIChatConversationFactoryArgs,
) => ThreadHistoryAdapter;

import {
  useChatRuns,
  isChatRunActive,
  selectChatRun,
  warnBeforeChatUnload,
  disposeChatRuns,
} from "../lib/chat-runs-store.ts";

interface AGUIRuntimeProviderProps {
  children: React.ReactNode;
  headlessChildren?: React.ReactNode;
  active?: boolean;
  conversationUrl?: string;
  /** Custom fetch for agent requests. Handles URL rewriting + auth in production. */
  fetchFn?: typeof fetch;
  /**
   * Optional stable thread id for the AG-UI adapter. When set, the
   * agent's POST body carries this id so server-side persistence
   * (Foundry thread, conversation row) targets the same conversation
   * across reloads / resumes. Changing the id selects an independent
   * runtime; running conversations remain mounted in the background.
   */
  threadId?: string;
  /**
   * Conversation id captured from the current URL when the user
   * resumed an existing chat (e.g. ``/chat/<id>``), or ``undefined``
   * for a brand-new chat. Distinct from ``threadId``: the host shell
   * MAY set ``threadId`` from a non-URL source (a sticky active
   * conversation, a freshly-minted UUID) so ``threadId`` alone can't
   * tell a history adapter "we're resuming". ``urlMatch`` carries
   * that signal verbatim into ``historyAdapterFactory`` so the
   * adapter can decide whether to load history (resume) or
   * initialise empty (fresh) without inferring from ``threadId``.
   */
  urlMatch?: string;
  /**
   * Factory that builds the assistant-ui ``ThreadHistoryAdapter`` for
   * this mount. Called once after the AG-UI adapter exists so it can
   * receive both the URL match (when resuming) and the adapter's own
   * thread id (always set — covers fresh chats). Pass alongside
   * ``threadId`` for resumed chats; pass without ``threadId`` to get
   * a fresh-chat runtime that still persists.
   */
  historyAdapterFactory?: AGUIHistoryAdapterFactory;
}

interface AGUIContextValue {
  adapter: AGUIAdapterSDK;
  resetThread: () => void;
  selectRetainedThread: (threadId: string) => boolean;
}

const AGUIAdapterContext = createContext<AGUIContextValue | null>(null);

export function useAGUIAdapter() {
  const context = useContext(AGUIAdapterContext);
  if (!context) {
    throw new Error("useAGUIAdapter must be used within AGUIRuntimeProvider");
  }
  return context;
}

/** Whether this runtime owns visible UI effects; standalone consumers remain active. */
export function useIsForegroundChat() {
  const context = useContext(AGUIAdapterContext);
  return useChatRuns(
    (state) =>
      !context || state.foregroundId === null || state.foregroundId === context.adapter.threadId,
  );
}

let mountedProviders = 0;

export function AGUIRuntimeProvider(props: AGUIRuntimeProviderProps) {
  const [freshId, setFreshId] = useState<string>(() => crypto.randomUUID());
  const id = props.threadId ?? freshId;
  // Hosts with stable ids advance the id through the lifecycle callback.
  const resetThread = useCallback(() => {
    if (!props.threadId) setFreshId(crypto.randomUUID());
  }, [props.threadId]);
  const selectRetainedThread = (threadId: string) => {
    if (props.threadId) return false;
    setFreshId(threadId);
    return true;
  };
  const [sessions, setSessions] = useState(() => [{ ...props, threadId: id }]);
  if (!sessions.some((session) => session.threadId === id)) {
    const runs = useChatRuns.getState().runs;
    // Keep running runtimes mounted. Limit the cache of idle conversations.
    const idle = sessions.filter(
      (session) => !runs[session.threadId] || !isChatRunActive(runs[session.threadId]!),
    );
    const retained = new Set(idle.slice(-19).map((session) => session.threadId));
    setSessions([
      ...sessions.filter(
        (session) =>
          retained.has(session.threadId) ||
          (runs[session.threadId] && isChatRunActive(runs[session.threadId]!)),
      ),
      { ...props, threadId: id },
    ]);
  }
  useLayoutEffect(() => {
    if (props.active !== false) selectChatRun(id);
  }, [id, props.active]);
  useEffect(() => {
    mountedProviders++;
    window.addEventListener("beforeunload", warnBeforeChatUnload);
    return () => {
      mountedProviders--;
      queueMicrotask(() => {
        if (mountedProviders === 0) {
          window.removeEventListener("beforeunload", warnBeforeChatUnload);
          disposeChatRuns();
        }
      });
    };
  }, []);
  return (
    <>
      {sessions.map((session) => (
        <AGUIRuntimeInner
          key={session.threadId}
          {...session}
          resetThread={resetThread}
          selectRetainedThread={selectRetainedThread}
        >
          {session.headlessChildren}
          {props.active !== false && session.threadId === id ? props.children : null}
        </AGUIRuntimeInner>
      ))}
    </>
  );
}

function AGUIRuntimeInner({
  children,
  fetchFn,
  threadId,
  urlMatch,
  historyAdapterFactory,
  resetThread,
  selectRetainedThread,
  conversationUrl,
}: AGUIRuntimeProviderProps & {
  resetThread: () => void;
  selectRetainedThread: (threadId: string) => boolean;
}) {
  const adapter = useMemo(
    () =>
      new AGUIAdapterSDK(
        "/api/agent",
        // Only pass options if at least one is set, mirroring the prior
        // single-arg semantics for the "fresh chat, no overrides" case.
        fetchFn || threadId ? { fetchFn, threadId, conversationUrl } : undefined,
      ),
    [fetchFn, threadId, conversationUrl],
  );

  // Hosts may register a custom adapter (see ``registerAttachmentAdapter``);
  // the shell's inline-base64 adapter is the default.
  const registeredAdapter = useAttachmentAdapterStore((s) => s.adapter);
  const attachmentAdapter = useMemo(
    () => registeredAdapter ?? new FileAttachmentAdapter(),
    [registeredAdapter],
  );

  // Each retained runtime owns one history adapter, including after navigation.
  // Changing the URL must never load persisted messages over an in-flight stream.
  const [historyAdapter] = useState<ThreadHistoryAdapter | undefined>(() => {
    if (!historyAdapterFactory) return undefined;
    return historyAdapterFactory({
      // ``urlMatch`` is the URL-derived resume signal (undefined for
      // fresh chats). ``aguiThreadId`` is always defined — the AG-UI
      // adapter mints it on construction. The factory uses ``urlMatch``
      // to decide "load history" vs "initialise empty", and
      // ``aguiThreadId`` to identify the row to write into.
      urlMatch,
      aguiThreadId: adapter.threadId,
    });
  });

  // Voice is opt-in and host-supplied (see ``registerVoiceAdapter``).
  // Both slots stay absent unless a module registered one, so a runtime
  // without voice is byte-for-byte the runtime that existed before:
  // assistant-ui reports the capability as unavailable and every voice
  // affordance hides itself.
  const voiceAdapter = useVoiceAdapterStore((s) => s.voice);
  const speechAdapter = useVoiceAdapterStore((s) => s.speech);

  const runtime = useLocalRuntime(adapter, {
    adapters: {
      attachments: attachmentAdapter,
      // history is optional — when undefined, the runtime acts as a
      // pure in-memory thread (the original behaviour). When provided,
      // assistant-ui calls .load() on mount to seed past messages and
      // .append() after every turn.
      ...(historyAdapter ? { history: historyAdapter } : {}),
      ...(voiceAdapter ? { voice: voiceAdapter } : {}),
      ...(speechAdapter ? { speech: speechAdapter } : {}),
    },
  });

  return (
    <AGUIAdapterContext.Provider value={{ adapter, resetThread, selectRetainedThread }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <TooltipProvider>
          {children && <ShowDocumentToolUI />}
          {children && <ClientToolExecutor />}
          {children}
        </TooltipProvider>
      </AssistantRuntimeProvider>
    </AGUIAdapterContext.Provider>
  );
}
