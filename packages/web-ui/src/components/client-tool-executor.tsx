/**
 * Client Tool Executor — registers custom UIs for client-side tools.
 *
 * Tool execution happens in the AGUIRunner (client-side tools intercepted at
 * `tool-call-end`). This component only registers the UI rendering and
 * injects the navigate function (which requires React Router context).
 *
 * Modern assistant-ui v0.12 pattern: each tool UI is a top-level
 * `makeAssistantToolUI(...)` component. We mount them as children of
 * `<ClientToolExecutor>` inside the AssistantRuntimeProvider tree.
 */

import { makeAssistantToolUI } from "@assistant-ui/react";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { setNavigateFunction } from "../lib/client-tools.ts";
import { getOpenPanelOutput, OPEN_PANEL_TOOL_NAME } from "../lib/open-panel-output.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { ConfirmationCard } from "./confirmation-card.tsx";
import { describeCaptureResult } from "../lib/capture-app-view.ts";
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
  Camera,
} from "lucide-react";

const NavigateUI = makeAssistantToolUI<{ path: string }, { status: string }>({
  toolName: "ui_navigate",
  render: ({ args, result, status }) => {
    const navigate = useNavigate();
    return (
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
    );
  },
});

const SetThemeUI = makeAssistantToolUI<{ mode: string }, { status: string }>({
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

const OpenPanelUI = makeAssistantToolUI<
  { title: string; path?: string; content?: string; type?: string },
  { status: string }
>({
  toolName: OPEN_PANEL_TOOL_NAME,
  render: ({ args, result, status }) => {
    const panel = getOpenPanelOutput(args, result);

    return (
      <ToolCallCard
        icon={<PanelRight className="size-3.5" />}
        title="Open Panel"
        description={
          status.type === "running"
            ? "Opening panel..."
            : panel
              ? `Panel: ${panel.title}`
              : "Panel failed"
        }
        status={status}
        action={
          status.type === "complete" && panel?.content
            ? { label: "View", onClick: () => useToolPanelStore.getState().openPanel(panel) }
            : undefined
        }
        className="w-full"
      />
    );
  },
});

const SelectItemUI = makeAssistantToolUI<{ itemId?: string }, unknown>({
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

const UpdateContentUI = makeAssistantToolUI<{ fields?: Record<string, unknown> }, unknown>({
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

const HighlightUI = makeAssistantToolUI<{ entityId?: string }, unknown>({
  toolName: "ui_highlight",
  render: ({ args, status }) => (
    <ToolCallCard
      icon={<Highlighter className="size-3.5" />}
      title="Highlight"
      description={status.type === "running" ? "Highlighting..." : `Highlighted: ${args?.entityId}`}
      status={status}
      className="w-full"
    />
  ),
});

const ConfirmUI = makeAssistantToolUI<{ action?: string; details?: string }, { status?: string }>({
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

const GetContextUI = makeAssistantToolUI<unknown, unknown>({
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

const CaptureViewUI = makeAssistantToolUI<unknown, unknown>({
  toolName: "ui_capture_view",
  render: ({ status, result }) => (
    <ToolCallCard
      icon={<Camera className="size-3.5" />}
      title="View app"
      description={
        status.type === "running" ? "Looking at your current view…" : describeCaptureResult(result)
      }
      status={status}
      className="w-full"
    />
  ),
});

export function ClientToolExecutor() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigateFunction(navigate);
  }, [navigate]);

  return (
    <>
      <NavigateUI />
      <SetThemeUI />
      <OpenPanelUI />
      <SelectItemUI />
      <UpdateContentUI />
      <HighlightUI />
      <ConfirmUI />
      <GetContextUI />
      <CaptureViewUI />
    </>
  );
}
