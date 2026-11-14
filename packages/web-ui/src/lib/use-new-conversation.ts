import { useCallback } from "react";
import { useNavigate } from "react-router";
import { citationStore } from "@lykomi/agent";
import { useAGUIAdapter } from "../components/ag-ui-runtime-provider.tsx";
import { useToolPanelStore } from "./tool-panel-store.ts";
import { useAppStore } from "./app-store.ts";
import { useSidebarStore } from "./sidebar-store.ts";
import { useChatLifecycleStore } from "./chat-lifecycle-store.ts";

/**
 * Shared hook for starting a new conversation.
 * Used by ChatHeader and Sidebar to keep behavior in sync.
 */
export function useNewConversation(options?: {
  navigateToChat?: boolean;
  preserveNavigation?: boolean;
}) {
  const { resetThread } = useAGUIAdapter();
  const navigate = useNavigate();
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const resetApp = useAppStore((s) => s.resetAll);
  const closeMobile = useSidebarStore((s) => s.closeMobile);

  return useCallback(() => {
    if (options?.preserveNavigation) {
      // New chat does not leave the page or dismiss its inspector. Keep the
      // live page context: its producers remain mounted and need not rerun.
      useAppStore.setState((state) => ({
        threadActive: false,
        contextItems: state.contextItems.filter(
          (item) => item.key && item.persistence === "ephemeral",
        ),
      }));
    } else {
      closePanel();
      const sentContext = useAppStore.getState().sentContext;
      resetApp();
      useAppStore.setState({ sentContext });
    }
    closeMobile();
    // Clear only the foreground projection; retained transcripts keep their sources.
    citationStore.setState({ threadId: null, results: [] });
    // Notify the host app that a new thread is starting. Spaces wires
    // this to clear its active-chat sticky id so the AGUIRuntimeProvider's
    // ``effectiveThreadId`` advances to a freshly-minted UUID instead of
    // staying pinned to the previous chat. Must fire BEFORE ``resetThread``
    // so the next render's history adapter binds to the new id and
    // doesn't re-hydrate the prior chat's messages — the exact bug this
    // wiring fixes for the popover (``navigateToChat: false``) path,
    // where there is no ``/`` navigation to clear sticky for us.
    useChatLifecycleStore.getState().startNewConversation();
    resetThread();
    if (options?.navigateToChat ?? true) {
      navigate("/");
    }
  }, [
    closePanel,
    resetApp,
    options?.preserveNavigation,
    closeMobile,
    resetThread,
    options?.navigateToChat,
    navigate,
  ]);
}
