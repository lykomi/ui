import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useAui } from "@assistant-ui/react";
import { useStore } from "zustand";
import { citationStore } from "@lastspace/agent";
import { useAGUIAdapter } from "../components/ag-ui-runtime-provider.tsx";
import { useToolPanelStore } from "./tool-panel-store.ts";
import { useAppStore } from "./app-store.ts";
import { useSidebarStore } from "./sidebar-store.ts";

/**
 * Shared hook for starting a new conversation.
 * Used by ChatHeader and Sidebar to keep behavior in sync.
 */
export function useNewConversation() {
  const aui = useAui();
  const { resetThread } = useAGUIAdapter();
  const navigate = useNavigate();
  const closePanel = useToolPanelStore((s) => s.closePanel);
  const resetApp = useAppStore((s) => s.resetAll);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const clearCitations = useStore(citationStore, (s) => s.clear);

  return useCallback(() => {
    closePanel();
    resetApp();
    closeMobile();
    clearCitations();
    resetThread();
    aui.threads().switchToNewThread();
    navigate("/");
  }, [closePanel, resetApp, closeMobile, clearCitations, resetThread, aui, navigate]);
}
