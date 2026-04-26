/**
 * Dynamic Client Tool Registry — Zustand store for client-side AG-UI tools.
 *
 * Tools are split into two categories:
 * - **Global tools**: always available (navigate, set_theme, open_panel, etc.)
 * - **Page tools**: registered by the active page via usePageTools(), removed on unmount
 *
 * The adapter reads from this store on every request to get the current
 * tool schemas and executors. Pages declare their capabilities by calling
 * usePageTools() — no need to edit core files.
 */

import { create } from "zustand";
import type { Tool as AGUITool } from "@ag-ui/core";

export interface ClientToolEntry {
  /** Tool name (must be unique across global + page tools) */
  name: string;
  /** Tool description for the LLM */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Execution function — called by the adapter at TOOL_CALL_END */
  execute: (argsJson: string) => Promise<string>;
}

interface ClientToolRegistryState {
  globalTools: Map<string, ClientToolEntry>;
  pageTools: Map<string, ClientToolEntry>;

  /** Register a global tool (called once at app init) */
  registerGlobal: (tool: ClientToolEntry) => void;

  /** Register page-scoped tools (called by usePageTools on mount) */
  registerPageTools: (tools: ClientToolEntry[]) => void;

  /** Remove page-scoped tools (called by usePageTools on unmount) */
  clearPageTools: () => void;

  /** Get all active tool schemas for the adapter */
  getActiveSchemas: () => AGUITool[];

  /** Check if a tool name is registered */
  isRegistered: (name: string) => boolean;

  /** Execute a registered tool by name */
  executeTool: (name: string, argsJson: string) => Promise<string>;
}

export const useClientToolRegistry = create<ClientToolRegistryState>((set, get) => ({
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
