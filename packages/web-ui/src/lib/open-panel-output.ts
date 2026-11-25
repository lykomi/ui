import type { ToolPanelContent } from "./tool-panel-store.ts";

export const OPEN_PANEL_TOOL_NAME = "ui_open_panel";

export function getOpenPanelOutput(
  args: { title?: unknown; path?: unknown; content?: unknown; type?: unknown } | undefined,
  result: unknown,
): ToolPanelContent | undefined {
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return;
    }
  }
  if (!result || typeof result !== "object" || !("status" in result) || result.status !== "success")
    return;

  const title = typeof args?.title === "string" && args.title.trim() ? args.title : "Panel output";
  if (typeof args?.path === "string" && args.path) {
    return { title, content: args.path, type: "page" };
  }

  const content = typeof args?.content === "string" ? args.content : "";
  switch (args?.type) {
    case "text":
    case "page":
    case "pdf":
    case "graph":
      return { title, content, type: args.type };
    default:
      return { title, content, type: "markdown" };
  }
}
