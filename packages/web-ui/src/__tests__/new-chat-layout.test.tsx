import { act, useEffect } from "react";
import { MemoryRouter } from "react-router";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
import { AGUIRuntimeProvider, useAGUIAdapter } from "../components/ag-ui-runtime-provider.tsx";
import { disposeChatRuns } from "../lib/chat-runs-store.ts";
import { useWorkbenchCollapsed } from "../workbench/layout-state.tsx";

it("retains the expanded layout across a new runtime and a resumed conversation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const mounted = vi.fn();
  function Probe() {
    const [collapsed, setCollapsed] = useWorkbenchCollapsed(true);
    const { resetThread } = useAGUIAdapter();
    useEffect(() => {
      mounted();
    }, []);
    return (
      <button
        onClick={() => {
          setCollapsed(false);
          resetThread();
        }}
      >
        {collapsed ? "collapsed" : "expanded"}
      </button>
    );
  }
  const render = (threadId?: string) =>
    act(async () => {
      root.render(
        <MemoryRouter>
          <AGUIRuntimeProvider threadId={threadId}>
            <Probe />
          </AGUIRuntimeProvider>
        </MemoryRouter>,
      );
    });
  try {
    await render();
    expect(host.textContent).toBe("collapsed");
    await act(async () => host.querySelector("button")!.click());
    expect(mounted).toHaveBeenCalledTimes(2);
    expect(host.textContent).toBe("expanded");
    await render("resumed-thread");
    expect(mounted).toHaveBeenCalledTimes(3);
    expect(host.textContent).toBe("expanded");
  } finally {
    await act(async () => root.unmount());
    disposeChatRuns();
    vi.unstubAllGlobals();
  }
});
