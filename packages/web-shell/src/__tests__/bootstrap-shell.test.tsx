import { describe, expect, it, vi, beforeEach } from "vitest";

const renderSpy = vi.hoisted(() => vi.fn());
const createRootSpy = vi.hoisted(() => vi.fn(() => ({ render: renderSpy })));

vi.mock("react-dom/client", () => ({
  createRoot: createRootSpy,
}));

vi.mock("../shell-app.tsx", () => ({
  ShellApp: () => null,
}));

import { bootstrapShell } from "../bootstrap-shell.tsx";

describe("bootstrapShell", () => {
  beforeEach(() => {
    renderSpy.mockClear();
    createRootSpy.mockClear();
    document.body.innerHTML = "";
  });

  it("passes agentFetch through to ShellApp", () => {
    const root = document.createElement("div");
    const agentFetch = vi.fn<typeof fetch>();

    bootstrapShell({
      rootElement: root,
      agentFetch,
      strictMode: false,
    });

    expect(createRootSpy).toHaveBeenCalledWith(root);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy.mock.calls[0][0].props.agentFetch).toBe(agentFetch);
  });
});
