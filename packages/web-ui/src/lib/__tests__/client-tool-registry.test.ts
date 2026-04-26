import { describe, it, expect, beforeEach } from "vitest";
import { useClientToolRegistry } from "../client-tool-registry.ts";
import type { ClientToolEntry } from "../client-tool-registry.ts";

function makeTool(name: string): ClientToolEntry {
  return {
    name,
    description: `${name} tool`,
    parameters: { type: "object", properties: {} },
    execute: async () => JSON.stringify({ ok: true }),
  };
}

describe("useClientToolRegistry", () => {
  beforeEach(() => {
    useClientToolRegistry.setState({ globalTools: new Map(), pageTools: new Map() });
  });

  describe("registerGlobal", () => {
    it("adds a global tool", () => {
      useClientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      expect(useClientToolRegistry.getState().isRegistered("ui_navigate")).toBe(true);
    });
  });

  describe("registerPageTools / clearPageTools", () => {
    it("registers page-scoped tools", () => {
      useClientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      expect(useClientToolRegistry.getState().isRegistered("page_search")).toBe(true);
    });

    it("clears page tools", () => {
      useClientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      useClientToolRegistry.getState().clearPageTools();
      expect(useClientToolRegistry.getState().isRegistered("page_search")).toBe(false);
    });
  });

  describe("getActiveSchemas", () => {
    it("merges global and page tools", () => {
      useClientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      useClientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      const schemas = useClientToolRegistry.getState().getActiveSchemas();
      expect(schemas.map((s) => s.name).sort()).toEqual(["page_search", "ui_navigate"]);
    });

    it("page tools override global tools with same name", () => {
      useClientToolRegistry.getState().registerGlobal(makeTool("shared_tool"));
      const pageTool = makeTool("shared_tool");
      pageTool.description = "page version";
      useClientToolRegistry.getState().registerPageTools([pageTool]);

      const schemas = useClientToolRegistry.getState().getActiveSchemas();
      const match = schemas.find((s) => s.name === "shared_tool");
      expect(match?.description).toBe("page version");
    });
  });

  describe("executeTool", () => {
    it("executes a registered tool", async () => {
      useClientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      const result = await useClientToolRegistry.getState().executeTool("ui_navigate", "{}");
      expect(JSON.parse(result)).toEqual({ ok: true });
    });

    it("returns error for unknown tool", async () => {
      const result = await useClientToolRegistry.getState().executeTool("unknown_tool", "{}");
      expect(JSON.parse(result).error).toContain("Unknown client tool");
    });

    it("page tool takes precedence over global", async () => {
      const globalTool = makeTool("shared");
      globalTool.execute = async () => "global";
      const pageTool = makeTool("shared");
      pageTool.execute = async () => "page";

      useClientToolRegistry.getState().registerGlobal(globalTool);
      useClientToolRegistry.getState().registerPageTools([pageTool]);

      const result = await useClientToolRegistry.getState().executeTool("shared", "{}");
      expect(result).toBe("page");
    });
  });
});
