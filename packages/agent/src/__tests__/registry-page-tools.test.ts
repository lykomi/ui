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

  const names = () =>
    clientToolRegistry
      .getState()
      .listPageTools()
      .map((t) => t.name);

  it("contributed tools survive a host re-registration and are dropped by name", () => {
    const registry = clientToolRegistry.getState();
    registry.registerPageTools([tool("page_a"), tool("page_b")]);
    registry.addPageTools([tool("list_state"), tool("list_filter")]);
    expect(names()).toEqual(["page_a", "page_b", "list_state", "list_filter"]);
    registry.registerPageTools([tool("page_c")]); // the host's catalogue changed
    expect(names()).toEqual(["page_c", "list_state", "list_filter"]);
    expect(
      clientToolRegistry
        .getState()
        .getActiveSchemas()
        .map((s) => s.name),
    ).toEqual(["page_c", "list_state", "list_filter"]);
    registry.removePageTools(["list_state", "missing"]);
    expect(names()).toEqual(["page_c", "list_filter"]);
    const before = clientToolRegistry.getState().contributedTools;
    registry.removePageTools(["missing"]);
    expect(clientToolRegistry.getState().contributedTools).toBe(before);
  });

  it("a contributed tool shadows a host tool of the same name and the host tool comes back on removal", async () => {
    const registry = clientToolRegistry.getState();
    registry.registerPageTools([{ ...tool("shared"), execute: async () => "host" }]);
    registry.addPageTools([{ ...tool("shared"), execute: async () => "component" }]);
    expect(await clientToolRegistry.getState().executeTool("shared", "{}")).toBe("component");
    expect(clientToolRegistry.getState().isRegistered("shared")).toBe(true);
    registry.removePageTools(["shared"]);
    expect(await clientToolRegistry.getState().executeTool("shared", "{}")).toBe("host");
    registry.clearPageTools();
    expect(names()).toEqual([]);
    expect(clientToolRegistry.getState().isRegistered("shared")).toBe(false);
  });
});
