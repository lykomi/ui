import { act } from "react";
import { MemoryRouter } from "react-router";
import { createRoot } from "react-dom/client";
import { ExportedMessageRepository, useAuiState } from "@assistant-ui/react";
import { expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
import { AGUIRuntimeProvider } from "../components/ag-ui-runtime-provider.tsx";
import { disposeChatRuns, removeChatRun } from "../lib/chat-runs-store.ts";

it("clears a deleted transcript and never reloads it when revisiting its id", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  const load = vi.fn(async () =>
    ExportedMessageRepository.fromArray([
      { id: "old", role: "user", content: [{ type: "text", text: "Private old transcript" }] },
    ]),
  );
  const historyAdapterFactory = () => ({ load, append: async () => {} });
  function Probe() {
    const count = useAuiState((state) => state.thread.messages.length);
    return <output>{count}</output>;
  }
  const render = async (threadId: string) =>
    act(async () => {
      root.render(
        <MemoryRouter>
          <AGUIRuntimeProvider threadId={threadId} historyAdapterFactory={historyAdapterFactory}>
            <Probe />
          </AGUIRuntimeProvider>
        </MemoryRouter>,
      );
    });
  try {
    await render("deleted-runtime");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(host.textContent).toBe("1");
    await act(async () => removeChatRun("deleted-runtime"));
    expect(host.textContent).toBe("0");
    const calls = load.mock.calls.length;
    await render("fresh-runtime");
    await render("deleted-runtime");
    expect(host.textContent).toBe("0");
    expect(load.mock.calls.length).toBe(calls + 1);
  } finally {
    await act(async () => root.unmount());
    disposeChatRuns();
    vi.unstubAllGlobals();
  }
});
