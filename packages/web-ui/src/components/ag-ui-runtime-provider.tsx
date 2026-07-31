import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import type { ThreadHistoryAdapter } from "@assistant-ui/react";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { AGUIAdapterSDK } from "../lib/ag-ui-adapter.ts";
import { FileAttachmentAdapter } from "../lib/attachment-adapter.ts";
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

interface AGUIRuntimeProviderProps {
  children: React.ReactNode;
  /** Custom fetch for agent requests. Handles URL rewriting + auth in production. */
  fetchFn?: typeof fetch;
  /**
   * Optional stable thread id for the AG-UI adapter. When set, the
   * agent's POST body carries this id so server-side persistence
   * (Foundry thread, conversation row) targets the same conversation
   * across reloads / resumes. Changing the id remounts the inner
   * runtime — past messages from a different thread don't bleed
   * into the new one.
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
}

const AGUIAdapterContext = createContext<AGUIContextValue | null>(null);

export function useAGUIAdapter() {
  const context = useContext(AGUIAdapterContext);
  if (!context) {
    throw new Error("useAGUIAdapter must be used within AGUIRuntimeProvider");
  }
  return context;
}

export function AGUIRuntimeProvider(props: AGUIRuntimeProviderProps) {
  // Splitting render across an outer wrapper + a keyed inner is the
  // canonical React idiom for "rebuild this stateful subtree when X
  // changes". assistant-ui's runtime is created inside useLocalRuntime
  // and tracks its messages internally; swapping threadId or history
  // mid-life would leave stale state. Keying the inner subtree on
  // threadId (+ the manual reset counter) guarantees a clean runtime
  // per conversation, matching the ChatGPT-style "click → fresh chat
  // backed by past messages" UX.
  const [resetKey, setResetKey] = useState(0);
  const resetThread = useCallback(() => setResetKey((p) => p + 1), []);

  const innerKey = `${props.threadId ?? "fresh"}:${resetKey}`;

  return (
    <AGUIRuntimeInner key={innerKey} {...props} resetThread={resetThread} />
  );
}

function AGUIRuntimeInner({
  children,
  fetchFn,
  threadId,
  urlMatch,
  historyAdapterFactory,
  resetThread,
}: AGUIRuntimeProviderProps & { resetThread: () => void }) {
  const adapter = useMemo(
    () =>
      new AGUIAdapterSDK(
        "/api/agent",
        // Only pass options if at least one is set, mirroring the prior
        // single-arg semantics for the "fresh chat, no overrides" case.
        fetchFn || threadId ? { fetchFn, threadId } : undefined,
      ),
    [fetchFn, threadId],
  );

  const attachmentAdapter = useMemo(() => new FileAttachmentAdapter(), []);

  // Build the history adapter ONCE per inner mount, after the AG-UI
  // adapter exists so we know its thread id. The keyed-remount in the
  // outer wrapper ensures threadId changes trigger a fresh adapter +
  // fresh history adapter together, so resumed chats hydrate from the
  // right conversation and fresh chats persist under their assistant-
  // ui-minted UUID.
  const historyAdapter = useMemo<ThreadHistoryAdapter | undefined>(() => {
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
    // adapter is stable for the life of this inner mount (keyed remount
    // covers the threadId change case), so it's OK to depend on the
    // factory + urlMatch here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyAdapterFactory, urlMatch]);

  const runtime = useLocalRuntime(adapter, {
    adapters: {
      attachments: attachmentAdapter,
      // history is optional — when undefined, the runtime acts as a
      // pure in-memory thread (the original behaviour). When provided,
      // assistant-ui calls .load() on mount to seed past messages and
      // .append() after every turn.
      ...(historyAdapter ? { history: historyAdapter } : {}),
    },
  });

  return (
    <AGUIAdapterContext.Provider value={{ adapter, resetThread }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <TooltipProvider>
          <ShowDocumentToolUI />
          <ClientToolExecutor />
          {children}
        </TooltipProvider>
      </AssistantRuntimeProvider>
    </AGUIAdapterContext.Provider>
  );
}
