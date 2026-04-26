/**
 * Client Tool Executor — renders custom UI for client-side tools.
 *
 * Tool execution happens in the adapter (at TOOL_CALL_END interception).
 * This component only registers custom UIs via useAssistantToolUI and
 * injects the navigate function (which requires React context).
 */

import { useAssistantToolUI } from "@assistant-ui/react";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { setNavigateFunction } from "../lib/client-tools.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { ConfirmationCard } from "./confirmation-card.tsx";
import { ToolCallCard } from "./tool-call-card.tsx";
import {
  Navigation,
  Palette,
  PanelRight,
  MousePointerClick,
  PenLine,
  Highlighter,
  ShieldCheck,
  Info,
} from "lucide-react";

export function ClientToolExecutor() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigateFunction(navigate);
  }, [navigate]);

  // --- ui_navigate ---
  useAssistantToolUI({
    toolName: "ui_navigate",
    render: ({ args, result, status }) => (
      <ToolCallCard
        icon={<Navigation className="size-3.5" />}
        title="Navigate"
        description={
          status.type === "running"
            ? "Navigating..."
            : result?.status === "success"
              ? `Navigated to ${args?.path}`
              : "Navigation failed"
        }
        status={status}
        action={
          status.type === "complete" && args?.path
            ? { label: "Go to page", onClick: () => navigate(args.path) }
            : undefined
        }
        className="w-full"
      />
    ),
  });

  // --- ui_set_theme ---
  useAssistantToolUI({
    toolName: "ui_set_theme",
    render: ({ args, result, status }) => (
      <ToolCallCard
        icon={<Palette className="size-3.5" />}
        title="Set Theme"
        description={
          status.type === "running"
            ? "Changing theme..."
            : result?.status === "success"
              ? `Theme set to ${args?.mode}`
              : "Theme change failed"
        }
        status={status}
        className="w-full"
      />
    ),
  });

  // --- ui_open_panel ---
  useAssistantToolUI({
    toolName: "ui_open_panel",
    render: ({ args, result, status }) => {
      const handleReopen = () => {
        if (args?.path) {
          useToolPanelStore.getState().openPanel({
            title: args.title,
            content: args.path,
            type: "page",
          });
        } else if (args?.content) {
          useToolPanelStore.getState().openPanel({
            title: args.title,
            content: args.content,
            type: args.type || "markdown",
          });
        }
      };

      return (
        <ToolCallCard
          icon={<PanelRight className="size-3.5" />}
          title="Open Panel"
          description={
            status.type === "running"
              ? "Opening panel..."
              : result?.status === "success"
                ? `Panel: ${args?.title}`
                : "Panel failed"
          }
          status={status}
          action={
            status.type === "complete" && result?.status === "success"
              ? { label: "View", onClick: handleReopen }
              : undefined
          }
          className="w-full"
        />
      );
    },
  });

  // --- ui_select_item ---
  useAssistantToolUI({
    toolName: "ui_select_item",
    render: ({ args, status }) => (
      <ToolCallCard
        icon={<MousePointerClick className="size-3.5" />}
        title="Select Item"
        description={
          status.type === "running"
            ? "Selecting..."
            : args?.itemId
              ? `Selected: ${args.itemId}`
              : "Selection cleared"
        }
        status={status}
        className="w-full"
      />
    ),
  });

  // --- ui_update_content ---
  useAssistantToolUI({
    toolName: "ui_update_content",
    render: ({ args, status }) => {
      const fieldNames = args?.fields ? Object.keys(args.fields).join(", ") : "";
      return (
        <ToolCallCard
          icon={<PenLine className="size-3.5" />}
          title="Update Content"
          description={status.type === "running" ? "Updating..." : `Updated: ${fieldNames}`}
          status={status}
          className="w-full"
        />
      );
    },
  });

  // --- ui_highlight ---
  useAssistantToolUI({
    toolName: "ui_highlight",
    render: ({ args, status }) => (
      <ToolCallCard
        icon={<Highlighter className="size-3.5" />}
        title="Highlight"
        description={
          status.type === "running" ? "Highlighting..." : `Highlighted: ${args?.entityId}`
        }
        status={status}
        className="w-full"
      />
    ),
  });

  // --- ui_confirm ---
  useAssistantToolUI({
    toolName: "ui_confirm",
    render: ({ args, result, status }) => {
      if (result?.status === "pending") {
        return (
          <ConfirmationCard
            action={args?.action ?? "Unknown action"}
            details={args?.details}
            status={status}
          />
        );
      }
      return (
        <ToolCallCard
          icon={<ShieldCheck className="size-3.5" />}
          title="Confirmation Required"
          description={args?.action ?? "Confirmation requested"}
          status={status}
          className="w-full"
        />
      );
    },
  });

  // --- ui_get_context ---
  useAssistantToolUI({
    toolName: "ui_get_context",
    render: ({ status }) => (
      <ToolCallCard
        icon={<Info className="size-3.5" />}
        title="Get Context"
        description={status.type === "running" ? "Reading context..." : "Context loaded"}
        status={status}
        className="w-full"
      />
    ),
  });

  return null;
}
