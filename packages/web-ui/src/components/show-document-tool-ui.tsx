import { makeAssistantToolUI } from "@assistant-ui/react";
import { useRef } from "react";
import { FileText } from "lucide-react";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { ToolCallCard } from "./tool-call-card.tsx";

interface ShowDocumentArgs {
  title: string;
  content: string;
  type?: string;
}

interface ShowDocumentResult {
  status?: "success" | "error";
  message?: string;
}

export const ShowDocumentToolUI = makeAssistantToolUI<ShowDocumentArgs, ShowDocumentResult>({
  toolName: "show_document",
  render: ({ args, result, status, toolCallId }) => {
    const openPanel = useToolPanelStore((state) => state.openPanel);
    const openedToolCallsRef = useRef(new Set<string>());

    if (
      status.type === "complete" &&
      result?.status === "success" &&
      args &&
      !openedToolCallsRef.current.has(toolCallId)
    ) {
      openedToolCallsRef.current.add(toolCallId);
      queueMicrotask(() => {
        openPanel({
          title: args.title,
          content: args.content,
          type: (args.type as "markdown" | "text" | "page" | "pdf") || "markdown",
        });
      });
    }

    let description = "";
    if (status.type === "running") {
      description = "Opening document...";
    } else if (status.type === "complete" && result) {
      description =
        result.message ||
        (result.status === "success" ? "Document ready" : "Failed to open document");
    } else if (status.type === "requires-action") {
      description = "Action required to display document";
    }

    const handleViewDocument = () => {
      if (args) {
        openPanel({
          title: args.title,
          content: args.content,
          type: (args.type as "markdown" | "text" | "page" | "pdf") || "markdown",
        });
      }
    };

    return (
      <ToolCallCard
        icon={<FileText className="size-3.5" />}
        title="Document Display"
        description={description}
        status={status}
        className="w-full"
        action={
          status.type === "complete" && result?.status === "success" && args
            ? {
                label: "View Document",
                onClick: handleViewDocument,
              }
            : undefined
        }
      >
        {args && (
          <div className="text-muted-foreground text-xs">
            <span className="font-medium">Title:</span> {args.title}
            {args.type && (
              <span className="ml-2">
                <span className="font-medium">Type:</span> {args.type}
              </span>
            )}
          </div>
        )}
      </ToolCallCard>
    );
  },
});
