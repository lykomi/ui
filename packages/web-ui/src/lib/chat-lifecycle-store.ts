/**
 * Lifecycle DI store for chat-related cross-cutting concerns that
 * foundry-ui needs to invoke but spaces-web-ui owns the implementation
 * for. Avoids a circular dependency between the two packages.
 *
 * Today's only hook: ``onNewConversation`` — called when the user
 * starts a fresh chat (sidebar New Thread, popover compose button,
 * etc.). spaces-web-ui registers a callback at app init that clears
 * the sticky active-chat id so the next render mints a fresh runtime
 * thread id (otherwise the history adapter re-hydrates the previous
 * chat's messages immediately, defeating the "new thread" intent).
 *
 * Registration: ``useChatLifecycleStore.setState({ onNewConversation })``
 * once at app init. Foundry-ui's :func:`useNewConversation` invokes
 * ``onNewConversation`` synchronously inside its returned callback,
 * BEFORE :func:`resetThread` runs — so by the time the AGUIRuntimeProvider
 * re-renders, the sticky id is already null and the effective thread id
 * has already advanced to a freshly-minted UUID.
 *
 * Customers that don't use sticky id tracking can leave
 * ``onNewConversation`` null — the call site no-ops gracefully.
 */
import { create } from "zustand";

interface ChatLifecycleStore {
  newConversationVersion: number;
  startNewConversation: () => void;
  /**
   * Called from :func:`useNewConversation` when the user starts a
   * new thread. Spaces wires this to clear the active-chat sticky id.
   */
  onNewConversation: (() => void) | null;
  setOnNewConversation: (fn: (() => void) | null) => void;
}

export const useChatLifecycleStore = create<ChatLifecycleStore>((set, get) => ({
  newConversationVersion: 0,
  startNewConversation: () => {
    get().onNewConversation?.();
    set((state) => ({ newConversationVersion: state.newConversationVersion + 1 }));
  },
  onNewConversation: null,
  setOnNewConversation: (fn) => set({ onNewConversation: fn }),
}));
