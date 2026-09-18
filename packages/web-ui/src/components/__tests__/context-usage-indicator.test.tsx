import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A real vanilla store with the shape the indicator reads, so the test drives
// it the way the adapter and the chat config do.
const store = vi.hoisted(() => ({ ref: null as unknown }));

vi.mock("@iloveagents/foundry-agent", async () => {
  const { createStore } = await import("zustand/vanilla");
  const contextUsageStore = createStore<{
    windowTokens: number | null;
    byThread: Record<string, unknown>;
  }>()(() => ({ windowTokens: null, byThread: {} }));
  store.ref = contextUsageStore;
  return { contextUsageStore };
});

vi.mock("../ag-ui-adapter-context.ts", () => ({ useCurrentThreadId: () => "t1" }));

import { ContextUsageIndicator } from "../context-usage-indicator.tsx";

type Store = {
  setState: (s: { windowTokens?: number | null; byThread?: Record<string, unknown> }) => void;
};
const set = (windowTokens: number | null, inputTokens?: number) =>
  (store.ref as Store).setState({
    windowTokens,
    byThread:
      inputTokens === undefined
        ? {}
        : { t1: { inputTokens, outputTokens: null, contextUsed: null, contextLimit: null, at: 0 } },
  });
const setPair = (inputTokens: number, contextUsed: number, contextLimit: number) =>
  (store.ref as Store).setState({
    windowTokens: null,
    byThread: { t1: { inputTokens, outputTokens: null, contextUsed, contextLimit, at: 0 } },
  });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(() => root.render(<ContextUsageIndicator />));
const ring = () => container.querySelector<HTMLElement>("[data-context-usage]");

describe("ContextUsageIndicator", () => {
  it("shows nothing until the backend states how much a chat can hold", () => {
    set(null, 50_000);
    render();
    expect(ring()).toBeNull();
  });

  it("shows nothing before the thread's first model call", () => {
    set(128_000);
    render();
    expect(ring()).toBeNull();
  });

  it("states how full the chat is", () => {
    set(128_000, 32_000);
    render();
    expect(ring()?.dataset.contextUsage).toBe("ok");
    expect(ring()?.getAttribute("aria-label")).toBe("Context 25% used (32k of 128k tokens).");
  });

  it("prefers the server's own fill and ceiling over the model's raw count", () => {
    // 33k real input tokens on a first "hello" is mostly system prompt and
    // tool declarations; the conversation itself is small.
    setPair(33_000, 1_200, 128_000);
    render();
    expect(ring()?.dataset.contextUsage).toBe("ok");
    expect(ring()?.getAttribute("aria-label")).toBe("Context 1% used (1.2k of 128k tokens).");
  });

  it("warns near the ceiling and says what happens beyond it", () => {
    set(128_000, 110_000);
    render();
    expect(ring()?.dataset.contextUsage).toBe("warn");
    expect(ring()?.getAttribute("aria-label")).toContain("will soon be shortened");

    set(128_000, 200_000);
    render();
    expect(ring()?.dataset.contextUsage).toBe("full");
    expect(ring()?.getAttribute("aria-label")).toContain("Context 100% used (128k of 128k");
  });
});
