import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useAui } from "@assistant-ui/react";
import { useStore } from "zustand";
import { citationStore } from "@iloveagents/foundry-agent";
import { useAGUIAdapter } from "../components/ag-ui-runtime-provider.tsx";
import { useToolPanelStore } from "./tool-panel-store.ts";
import { useAppStore } from "./app-store.ts";
import { useSidebarStore } from "./sidebar-store.ts";

/**
 * Shared hook for starting a new conversation.
 * Used by ChatHeader and Sidebar to keep behavior in sync.
 */
export function useNewConversation(options?: { navigateToChat?: boolean; preserveNavigation?: boolean }) {
  const aui = useAui();
  const { resetThread } = useAGUIAdapter();
  const navigate = useNavigate();
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const resetApp = useAppStore((s) => s.resetAll);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const clearCitations = useStore(citationStore, (s) => s.clear);

  return useCallback(() => {
    const preserved = options?.preserveNavigation
      ? {
          currentPage: useAppStore.getState().currentPage,
          navContext: useAppStore.getState().navContext,
        }
      : null;
    closePanel();
    resetApp();
    if (preserved) {
      useAppStore.setState(preserved);
    }
    closeMobile();
    clearCitations();
    resetThread();
    aui.threads().switchToNewThread();
    if (options?.navigateToChat ?? true) {
      navigate("/");
    }
  }, [
    closePanel,
    resetApp,
    options?.preserveNavigation,
    closeMobile,
    clearCitations,
    resetThread,
    aui,
    options?.navigateToChat,
    navigate,
  ]);
}
