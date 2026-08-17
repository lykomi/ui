import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clientToolRegistry } from "@iloveagents/foundry-agent";
import { usePageTools } from "../use-page-tools.ts";

const schemaNames = () => clientToolRegistry.getState().getActiveSchemas().map((t) => t.name);

describe("usePageTools", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    clientToolRegistry.setState({ globalTools: new Map(), pageTools: new Map() });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const tool = (name: string, execute = async () => name) => ({
    name,
    description: `does ${name}`,
    parameters: { type: "object" as const, properties: {} },
    execute,
  });

  it("registers on mount and clears on unmount", async () => {
    function Page() {
      usePageTools([tool("page_info")]);
      return null;
    }
    await act(async () => root.render(<Page />));
    expect(schemaNames()).toEqual(["page_info"]);

    await act(async () => root.render(<></>));
    expect(schemaNames()).toEqual([]);
  });

  it("withdraws a tool the page can no longer perform", async () => {
    // The whole point: a read-only surface must stop advertising the
    // live-edit tool, or the model calls it and dead-ends on an error.
    function Page({ canEdit }: { canEdit: boolean }) {
      usePageTools([tool("page_info"), ...(canEdit ? [tool("page_edit")] : [])]);
      return null;
    }
    await act(async () => root.render(<Page canEdit />));
    expect(schemaNames()).toEqual(["page_info", "page_edit"]);

    await act(async () => root.render(<Page canEdit={false} />));
    expect(schemaNames()).toEqual(["page_info"]);
  });

  it("runs the latest render's closure, not the one captured at mount", async () => {
    // Tools used to register once, so a body reading state read the
    // FIRST render's value forever — pages worked around it with refs.
    function Page({ version }: { version: number }) {
      usePageTools([tool("page_info", async () => `v${version}`)]);
      return null;
    }
    await act(async () => root.render(<Page version={1} />));
    await act(async () => root.render(<Page version={2} />));

    await expect(clientToolRegistry.getState().executeTool("page_info", "{}")).resolves.toBe("v2");
  });

  it("does not re-register when only the array identity changed", async () => {
    let registrations = 0;
    const original = clientToolRegistry.getState().registerPageTools;
    clientToolRegistry.setState({
      registerPageTools: (tools) => {
        registrations++;
        original(tools);
      },
    });

    function Page({ tick }: { tick: number }) {
      // A fresh literal every render, identical schema — the common case.
      usePageTools([tool("page_info", async () => String(tick))]);
      return null;
    }
    try {
      await act(async () => root.render(<Page tick={1} />));
      await act(async () => root.render(<Page tick={2} />));
      expect(registrations).toBe(1);
    } finally {
      // The store is module-scoped: a counting stub left in place would
      // follow every later test in the file, and the next file too.
      clientToolRegistry.setState({ registerPageTools: original });
    }
  });
});
