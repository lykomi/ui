import { createStore } from "zustand/vanilla";
import type { Tool as AGUITool } from "@ag-ui/core";

/**
 * Dynamic Client Tool Registry — vanilla zustand store for client-side AG-UI
 * tools.
 *
 * Tools are split into two categories:
 * - **Global tools**: always available (navigate, set_theme, open_panel, ...)
 * - **Page tools**: registered by the active page via the host shell, removed
 *   on unmount.
 *
 * The runner reads from this store on every request to get the current tool
 * schemas and executors. Pages declare their capabilities by calling
 * `registerPageTools()` — no need to edit core files.
 */
export interface ClientToolEntry {
  /** Tool name (must be unique across global + page tools) */
  name: string;
  /** Tool description for the LLM */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Execution function — called by the runner at TOOL_CALL_END */
  execute: (argsJson: string) => Promise<string>;
}

interface ClientToolRegistryState {
  globalTools: Map<string, ClientToolEntry>;
  pageTools: Map<string, ClientToolEntry>;

  /** Register a global tool (called once at app init) */
  registerGlobal: (tool: ClientToolEntry) => void;

  /** Register page-scoped tools (called by the host on mount) */
  registerPageTools: (tools: ClientToolEntry[]) => void;

  /** Remove page-scoped tools (called by the host on unmount) */
  clearPageTools: () => void;

  /** Get all active tool schemas for the runner */
  getActiveSchemas: () => AGUITool[];

  /** Check if a tool name is registered */
  isRegistered: (name: string) => boolean;

  /** Execute a registered tool by name */
  executeTool: (name: string, argsJson: string) => Promise<string>;
}

export const clientToolRegistry = createStore<ClientToolRegistryState>((set, get) => ({
  globalTools: new Map(),
  pageTools: new Map(),

  registerGlobal: (tool) => {
    const { globalTools } = get();
    const next = new Map(globalTools);
    next.set(tool.name, tool);
    set({ globalTools: next });
  },

  registerPageTools: (tools) => {
    const next = new Map<string, ClientToolEntry>();
    for (const tool of tools) {
      next.set(tool.name, tool);
    }
    set({ pageTools: next });
  },

  clearPageTools: () => {
    set({ pageTools: new Map() });
  },

  getActiveSchemas: () => {
    const { globalTools, pageTools } = get();
    // Merge: page tools override global tools with the same name
    const merged = new Map<string, ClientToolEntry>();
    for (const tool of globalTools.values()) {
      merged.set(tool.name, tool);
    }
    for (const tool of pageTools.values()) {
      merged.set(tool.name, tool); // page overrides global
    }
    return Array.from(merged.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  },

  isRegistered: (name) => {
    const { globalTools, pageTools } = get();
    return pageTools.has(name) || globalTools.has(name);
  },

  executeTool: async (name, argsJson) => {
    const { globalTools, pageTools } = get();
    // Page tools take precedence
    const tool = pageTools.get(name) ?? globalTools.get(name);
    if (!tool) {
      return JSON.stringify({ error: `Unknown client tool: ${name}` });
    }
    return tool.execute(argsJson);
  },
}));

/** Read-only registry view — what the runner consumes. */
export interface ToolRegistry {
  isRegistered: (name: string) => boolean;
  executeTool: (name: string, argsJson: string) => Promise<string>;
  getActiveSchemas: () => AGUITool[];
}
