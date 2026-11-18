import { createStore } from "zustand/vanilla";
import type { Tool as AGUITool, ContentPart } from "@ag-ui/core";

/** Text metadata stays in the tool result; visual content travels as AG-UI input. */
export type ClientToolResult = string | { result: string; inputContent: ContentPart[] };

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
  execute: (argsJson: string) => Promise<ClientToolResult>;
}

interface ClientToolRegistryState {
  globalTools: Map<string, ClientToolEntry>;
  /** Tools the host page registered (replaced wholesale by `registerPageTools`). */
  pageTools: Map<string, ClientToolEntry>;
  /** Tools contributed by components on the page (survive host re-registration). */
  contributedTools: Map<string, ClientToolEntry>;

  registerGlobal: (tool: ClientToolEntry) => void;

  /** Replace the host page's tool catalogue (called by the host on navigation / capability change). */
  registerPageTools: (tools: ClientToolEntry[]) => void;

  /**
   * Merge page-scoped tools by name, keeping the ones already registered —
   * for components (a list, a panel) that contribute their own tools next
   * to the page's. A contributed tool shadows a host tool of the same name
   * while mounted. Pair with `removePageTools` on unmount.
   */
  addPageTools: (tools: ClientToolEntry[]) => void;

  /** Drop contributed tools by name (a contributing component unmounted). */
  removePageTools: (names: string[]) => void;

  /** Every page-scoped tool: host tools, then contributed ones (which win by name). */
  listPageTools: () => ClientToolEntry[];

  /** Remove page-scoped tools — host and contributed (called by the host on unmount). */
  clearPageTools: () => void;

  getActiveSchemas: () => AGUITool[];
  isRegistered: (name: string) => boolean;
  executeTool: (name: string, argsJson: string) => Promise<ClientToolResult>;
}

export const clientToolRegistry = createStore<ClientToolRegistryState>((set, get) => ({
  globalTools: new Map(),
  pageTools: new Map(),
  contributedTools: new Map(),

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

  addPageTools: (tools) => {
    const next = new Map(get().contributedTools);
    for (const tool of tools) {
      next.set(tool.name, tool);
    }
    set({ contributedTools: next });
  },

  removePageTools: (names) => {
    const { contributedTools } = get();
    if (!names.some((name) => contributedTools.has(name))) return;
    const next = new Map(contributedTools);
    for (const name of names) {
      next.delete(name);
    }
    set({ contributedTools: next });
  },

  listPageTools: () => {
    const { pageTools, contributedTools } = get();
    const merged = new Map(pageTools);
    for (const tool of contributedTools.values()) {
      merged.set(tool.name, tool);
    }
    return Array.from(merged.values());
  },

  clearPageTools: () => {
    set({ pageTools: new Map(), contributedTools: new Map() });
  },

  getActiveSchemas: () => {
    const merged = new Map<string, ClientToolEntry>();
    for (const tool of get().globalTools.values()) {
      merged.set(tool.name, tool);
    }
    for (const tool of get().listPageTools()) {
      merged.set(tool.name, tool); // page overrides global, contributed overrides page
    }
    return Array.from(merged.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  },

  isRegistered: (name) => {
    const { globalTools, pageTools, contributedTools } = get();
    return contributedTools.has(name) || pageTools.has(name) || globalTools.has(name);
  },

  executeTool: async (name, argsJson) => {
    const { globalTools, pageTools, contributedTools } = get();
    const tool = contributedTools.get(name) ?? pageTools.get(name) ?? globalTools.get(name);
    if (!tool) {
      return JSON.stringify({ error: `Unknown client tool: ${name}` });
    }
    return tool.execute(argsJson);
  },
}));

export interface ToolRegistry {
  isRegistered: (name: string) => boolean;
  executeTool: (name: string, argsJson: string) => Promise<ClientToolResult>;
  getActiveSchemas: () => AGUITool[];
}
