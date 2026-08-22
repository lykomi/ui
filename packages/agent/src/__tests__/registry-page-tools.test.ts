/** Page tools can be contributed by components without clobbering the page's own. */
import { beforeEach, describe, expect, it } from "vitest";
import { clientToolRegistry, type ClientToolEntry } from "../tools/registry.ts";

const tool = (name: string): ClientToolEntry => ({
  name,
  description: name,
  parameters: { type: "object", properties: {} },
  execute: async () => name,
});

describe("clientToolRegistry page tools", () => {
  beforeEach(() => clientToolRegistry.getState().clearPageTools());

  it("registerPageTools replaces, addPageTools merges by name, removePageTools drops by name", () => {
    const registry = clientToolRegistry.getState();
    registry.registerPageTools([tool("page_a"), tool("page_b")]);
    registry.addPageTools([tool("list_state"), tool("page_b")]);
    expect([...clientToolRegistry.getState().pageTools.keys()]).toEqual([
      "page_a",
      "page_b",
      "list_state",
    ]);
    registry.removePageTools(["list_state", "missing"]);
    expect([...clientToolRegistry.getState().pageTools.keys()]).toEqual(["page_a", "page_b"]);
    const before = clientToolRegistry.getState().pageTools;
    registry.removePageTools(["missing"]);
    expect(clientToolRegistry.getState().pageTools).toBe(before);
    registry.registerPageTools([tool("only")]);
    expect([...clientToolRegistry.getState().pageTools.keys()]).toEqual(["only"]);
  });
});
