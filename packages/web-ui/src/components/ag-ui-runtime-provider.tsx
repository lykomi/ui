import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { AGUIAdapterSDK } from "../lib/ag-ui-adapter.ts";
import { FileAttachmentAdapter } from "../lib/attachment-adapter.ts";
import { ShowDocumentToolUI } from "./show-document-tool-ui.tsx";
import { ClientToolExecutor } from "./client-tool-executor.tsx";

interface AGUIRuntimeProviderProps {
  children: React.ReactNode;
  /** Custom fetch for agent requests. Handles URL rewriting + auth in production. */
  fetchFn?: typeof fetch;
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

export function AGUIRuntimeProvider({ children, fetchFn }: AGUIRuntimeProviderProps) {
  const [resetKey, setResetKey] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey triggers new adapter with fresh threadId
  const adapter = useMemo(
    () => new AGUIAdapterSDK("/api/agent", fetchFn ? { fetchFn } : undefined),
    [resetKey, fetchFn],
  );

  const resetThread = useCallback(() => {
    setResetKey((prev) => prev + 1);
  }, []);

  const attachmentAdapter = useMemo(() => new FileAttachmentAdapter(), []);

  const runtime = useLocalRuntime(adapter, {
    adapters: { attachments: attachmentAdapter },
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
