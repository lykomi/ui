/**
 * Global Client Tools — registered into the dynamic tool registry at app init.
 *
 * Naming convention:
 *   ui_*    — tools that affect the UI (navigate, theme, panel, content)
 *
 * Page-specific tools use their own prefix (e.g., page_search_documents).
 * The adapter reads from the registry (not this file) on every request.
 */

import { useThemeStore, type ThemeMode } from "./theme-store.ts";
import { useToolPanelStore } from "./tool-panel-store.ts";
import { useAppStore } from "./app-store.ts";
import { clientToolRegistry, type ClientToolEntry } from "@iloveagents/foundry-agent";

// ---------------------------------------------------------------------------
// Navigate function injection (needs React Router context)
// ---------------------------------------------------------------------------

let _navigateFn: ((path: string) => void) | null = null;

export function setNavigateFunction(fn: (path: string) => void) {
  _navigateFn = fn;
}

// ---------------------------------------------------------------------------
// Global tool definitions with executors
// ---------------------------------------------------------------------------

const GLOBAL_TOOLS: ClientToolEntry[] = [
  {
    name: "ui_navigate",
    description:
      "Navigate the user to a different page in the application. " +
      "Only use when the user explicitly asks to go to a page.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to navigate to (e.g. '/workspace')",
        },
      },
      required: ["path"],
    },
    execute: async (argsJson) => {
      const { path } = JSON.parse(argsJson || "{}");
      if (_navigateFn) _navigateFn(path);
      return JSON.stringify({ status: "success", path });
    },
  },
  {
    name: "ui_set_theme",
    description: "Change the application theme. Modes: 'light', 'dark', or 'system'.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["light", "dark", "system"],
          description: "The theme mode to apply",
        },
      },
      required: ["mode"],
    },
    execute: async (argsJson) => {
      const { mode } = JSON.parse(argsJson || "{}");
      useThemeStore.getState().setMode(mode as ThemeMode);
      return JSON.stringify({ status: "success", mode });
    },
  },
  {
    name: "ui_open_panel",
    description:
      "Show content in the side panel. Prefer this over ui_navigate to keep " +
      "chat visible. Use path for a page component (e.g. '/workspace'), " +
      "or content for generated markdown/text.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Panel title" },
        path: {
          type: "string",
          description: "Page path to render in the panel (e.g. '/workspace')",
        },
        content: {
          type: "string",
          description: "Markdown or text content (used when path is not provided)",
        },
        type: {
          type: "string",
          enum: ["markdown", "text"],
          description: "Content format (default: markdown)",
        },
      },
      required: ["title"],
    },
    execute: async (argsJson) => {
      const args = JSON.parse(argsJson || "{}");
      if (args.path) {
        useToolPanelStore.getState().openPanel({
          title: args.title,
          content: args.path,
          type: "page",
        });
      } else {
        useToolPanelStore.getState().openPanel({
          title: args.title,
          content: args.content || "",
          type: args.type || "markdown",
        });
      }
      return JSON.stringify({
        status: "success",
        title: args.title,
        mode: args.path ? "page" : "content",
      });
    },
  },
  {
    name: "ui_select_item",
    description: "Select an item in the current page by its ID. Highlights it in the UI.",
    parameters: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "The ID of the item to select (or null to deselect)",
        },
      },
      required: ["itemId"],
    },
    execute: async (argsJson) => {
      const { itemId } = JSON.parse(argsJson || "{}");
      useAppStore.getState().setSelectedItemId(itemId ?? null);
      return JSON.stringify({ status: "success", itemId });
    },
  },
  {
    name: "ui_update_content",
    description:
      "Update fields in the shared draft/form. Pass all fields as key-value " +
      "pairs in a single call. Works for one or many fields.",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description: "Key-value pairs of field names and their values",
          additionalProperties: true,
        },
      },
      required: ["fields"],
    },
    execute: async (argsJson) => {
      const { fields } = JSON.parse(argsJson || "{}");
      if (typeof window !== "undefined") {
        const detail: { fields: Record<string, unknown>; result?: unknown } = { fields };
        const request = new CustomEvent("ui:update-content", { detail, cancelable: true });
        window.dispatchEvent(request);
        if (request.defaultPrevented)
          return JSON.stringify(
            detail.result ?? { status: "error", error: "The form did not acknowledge the update." },
          );
      }
      const store = useAppStore.getState();
      for (const [key, value] of Object.entries(fields)) {
        store.updateContentField(key, value);
      }
      return JSON.stringify({ status: "success", fields });
    },
  },
  {
    name: "ui_highlight",
    description: "Highlight an entity in the UI to draw the user's attention.",
    parameters: {
      type: "object",
      properties: {
        entityId: {
          type: "string",
          description: "The ID of the entity to highlight",
        },
      },
      required: ["entityId"],
    },
    execute: async (argsJson) => {
      const { entityId } = JSON.parse(argsJson || "{}");
      useAppStore.getState().addHighlight(entityId);
      return JSON.stringify({ status: "success", entityId });
    },
  },
  {
    name: "ui_confirm",
    description:
      "Ask the user to confirm or reject an action before proceeding. " +
      "Use for destructive or important actions.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Short description of the action requiring confirmation",
        },
        details: {
          type: "string",
          description: "Optional details about what will happen",
        },
      },
      required: ["action"],
    },
    execute: async (argsJson) => {
      const { action, details } = JSON.parse(argsJson || "{}");
      return JSON.stringify({
        status: "pending",
        action,
        details: details || "",
        message: "Awaiting user confirmation via chat.",
      });
    },
  },
  {
    name: "ui_get_context",
    description:
      "Get the full application context: navigation breadcrumb from root " +
      "to current page (with accumulated metadata), selected items, draft " +
      "values, highlights, and user-pinned context items.",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => {
      const state = useAppStore.getState().getAgentState();
      const { useNavStore } = await import("./nav-store.ts");
      const navConfig = useNavStore.getState().config;

      // Build breadcrumb: root group → parent item → current leaf
      const breadcrumb: Array<{
        level: string;
        label: string;
        description?: string;
        meta?: Record<string, unknown>;
      }> = [];

      for (const group of navConfig) {
        for (const item of group.items) {
          if (item.to === state.navigation.page) {
            breadcrumb.push({ level: "group", label: group.label, meta: group.meta });
            breadcrumb.push({
              level: "page",
              label: item.label,
              description: item.description,
              meta: item.meta,
            });
            break;
          }
          if (item.children) {
            for (const child of item.children) {
              if (child.to === state.navigation.page) {
                breadcrumb.push({ level: "group", label: group.label, meta: group.meta });
                breadcrumb.push({
                  level: "parent",
                  label: item.label,
                  description: item.description,
                  meta: item.meta,
                });
                breadcrumb.push({
                  level: "page",
                  label: child.label,
                  description: child.description,
                  meta: child.meta,
                });
                break;
              }
            }
          }
        }
        if (breadcrumb.length > 0) break;
      }

      return JSON.stringify({
        status: "success",
        breadcrumb,
        currentPage: state.navigation,
        selectedItemId: state.selectedItemId,
        content: state.content,
        highlights: state.highlights,
        contextItems: state.contextItems,
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Registration — called once at module load
// ---------------------------------------------------------------------------

export function registerGlobalTools() {
  const registry = clientToolRegistry.getState();
  for (const tool of GLOBAL_TOOLS) {
    registry.registerGlobal(tool);
  }
}

// Auto-register on import
registerGlobalTools();
