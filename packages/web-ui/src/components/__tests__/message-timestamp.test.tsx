import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  message: { createdAt: new Date("2026-09-13T12:00:00Z") },
  thread: { isRunning: false },
}));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (select: (value: typeof state) => unknown) => select(state),
}));
const { MessageTimestamp } = await import("../message-timestamp.tsx");

it("suppresses timestamps during generation and restores them when the turn settles", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(() => root.render(<MessageTimestamp />));
    expect(host.querySelector("[title]")).not.toBeNull();
    state.thread.isRunning = true;
    act(() => root.render(<MessageTimestamp />));
    expect(host.textContent).toBe("");
    state.thread.isRunning = false;
    act(() => root.render(<MessageTimestamp />));
    expect(host.querySelector("[title]")).not.toBeNull();
  } finally {
    act(() => root.unmount());
    state.thread.isRunning = false;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  }
});
