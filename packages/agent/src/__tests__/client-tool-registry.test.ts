import { describe, it, expect, beforeEach } from "vitest";
import { clientToolRegistry } from "../tools/registry.ts";
import type { ClientToolEntry } from "../tools/registry.ts";

function makeTool(name: string): ClientToolEntry {
  return {
    name,
    description: `${name} tool`,
    parameters: { type: "object", properties: {} },
    execute: async () => JSON.stringify({ ok: true }),
  };
}

describe("clientToolRegistry", () => {
  beforeEach(() => {
    clientToolRegistry.setState({ globalTools: new Map(), pageTools: new Map() });
  });

  describe("registerGlobal", () => {
    it("adds a global tool", () => {
      clientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      expect(clientToolRegistry.getState().isRegistered("ui_navigate")).toBe(true);
    });
  });

  describe("registerPageTools / clearPageTools", () => {
    it("registers page-scoped tools", () => {
      clientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      expect(clientToolRegistry.getState().isRegistered("page_search")).toBe(true);
    });

    it("clears page tools", () => {
      clientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      clientToolRegistry.getState().clearPageTools();
      expect(clientToolRegistry.getState().isRegistered("page_search")).toBe(false);
    });
  });

  describe("getActiveSchemas", () => {
    it("merges global and page tools", () => {
      clientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      clientToolRegistry.getState().registerPageTools([makeTool("page_search")]);
      const schemas = clientToolRegistry.getState().getActiveSchemas();
      expect(schemas.map((s) => s.name).sort()).toEqual(["page_search", "ui_navigate"]);
    });

    it("page tools override global tools with same name", () => {
      clientToolRegistry.getState().registerGlobal(makeTool("shared_tool"));
      const pageTool = makeTool("shared_tool");
      pageTool.description = "page version";
      clientToolRegistry.getState().registerPageTools([pageTool]);

      const schemas = clientToolRegistry.getState().getActiveSchemas();
      const match = schemas.find((s) => s.name === "shared_tool");
      expect(match?.description).toBe("page version");
    });
  });

  describe("executeTool", () => {
    it("executes a registered tool", async () => {
      clientToolRegistry.getState().registerGlobal(makeTool("ui_navigate"));
      const result = await clientToolRegistry.getState().executeTool("ui_navigate", "{}");
      expect(JSON.parse(result)).toEqual({ ok: true });
    });

    it("returns error for unknown tool", async () => {
      const result = await clientToolRegistry.getState().executeTool("unknown_tool", "{}");
      expect(JSON.parse(result).error).toContain("Unknown client tool");
    });

    it("page tool takes precedence over global", async () => {
      const globalTool = makeTool("shared");
      globalTool.execute = async () => "global";
      const pageTool = makeTool("shared");
      pageTool.execute = async () => "page";

      clientToolRegistry.getState().registerGlobal(globalTool);
      clientToolRegistry.getState().registerPageTools([pageTool]);

      const result = await clientToolRegistry.getState().executeTool("shared", "{}");
      expect(result).toBe("page");
    });
  });
});
