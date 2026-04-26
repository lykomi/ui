// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock matchMedia before importing modules that use theme-store
vi.stubGlobal(
  "matchMedia",
  vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
);

const { useClientToolRegistry } = await import("../client-tool-registry");
await import("../client-tools"); // triggers registerGlobalTools()

const registry = () => useClientToolRegistry.getState();

describe("Global tool registration", () => {
  it("registers all global tools with ui_ prefix", () => {
    const names = registry()
      .getActiveSchemas()
      .map((s) => s.name)
      .sort();
    expect(names).toEqual([
      "ui_confirm",
      "ui_get_context",
      "ui_highlight",
      "ui_navigate",
      "ui_open_panel",
      "ui_select_item",
      "ui_set_theme",
      "ui_update_content",
    ]);
  });

  it("each schema has required fields", () => {
    for (const schema of registry().getActiveSchemas()) {
      expect(schema.name).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(schema.parameters).toBeDefined();
    }
  });
});

describe("isRegistered", () => {
  it("returns true for global tools", () => {
    expect(registry().isRegistered("ui_navigate")).toBe(true);
    expect(registry().isRegistered("ui_set_theme")).toBe(true);
  });

  it("returns false for unknown tools", () => {
    expect(registry().isRegistered("unknown_tool")).toBe(false);
  });
});

describe("executeTool", () => {
  it("ui_set_theme returns success", async () => {
    const result = await registry().executeTool("ui_set_theme", '{"mode":"dark"}');
    expect(JSON.parse(result).status).toBe("success");
  });

  it("ui_confirm returns pending", async () => {
    const result = await registry().executeTool("ui_confirm", '{"action":"Delete"}');
    expect(JSON.parse(result).status).toBe("pending");
  });

  it("ui_update_content updates multiple fields", async () => {
    const result = await registry().executeTool(
      "ui_update_content",
      '{"fields":{"title":"Test","priority":"High"}}',
    );
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("success");
    expect(parsed.fields).toEqual({ title: "Test", priority: "High" });
  });

  it("unknown tool returns error", async () => {
    const result = await registry().executeTool("unknown", "{}");
    expect(JSON.parse(result).error).toContain("Unknown client tool");
  });
});

describe("Page tools", () => {
  beforeEach(() => {
    registry().clearPageTools();
  });

  it("registers and clears page tools", () => {
    const before = registry().getActiveSchemas().length;

    registry().registerPageTools([
      {
        name: "page_custom_tool",
        description: "Page tool",
        parameters: { type: "object", properties: {} },
        execute: async () => JSON.stringify({ ok: true }),
      },
    ]);

    expect(registry().getActiveSchemas().length).toBe(before + 1);
    expect(registry().isRegistered("page_custom_tool")).toBe(true);

    registry().clearPageTools();
    expect(registry().isRegistered("page_custom_tool")).toBe(false);
  });

  it("page tools can be executed", async () => {
    registry().registerPageTools([
      {
        name: "page_my_tool",
        description: "Test",
        parameters: { type: "object", properties: {} },
        execute: async (argsJson) => {
          const { value } = JSON.parse(argsJson);
          return JSON.stringify({ received: value });
        },
      },
    ]);

    const result = await registry().executeTool("page_my_tool", '{"value":"hello"}');
    expect(JSON.parse(result).received).toBe("hello");
  });
});
