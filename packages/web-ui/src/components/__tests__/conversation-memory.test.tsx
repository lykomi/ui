import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { ConversationMemory, useConversationMemory } from "../conversation-memory.tsx";

type Store = { setState: (s: Record<string, unknown>) => void };
const usage = (inputTokens: number, contextUsed: number | null, contextLimit: number | null) =>
  (store.ref as Store).setState({
    windowTokens: null,
    byThread: { t1: { inputTokens, outputTokens: null, contextUsed, contextLimit, at: 0 } },
  });

function Probe() {
  const memory = useConversationMemory();
  return memory ? <ConversationMemory usage={memory} /> : <p data-empty />;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (store.ref as Store).setState({ windowTokens: null, byThread: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<Probe />));
const section = () => container.querySelector<HTMLElement>("[data-conversation-memory]");
const about = () =>
  container.querySelector<HTMLElement>("section button")?.getAttribute("aria-label") ?? "";
const bar = () => container.querySelector<HTMLElement>("[role=progressbar]");

describe("ConversationMemory", () => {
  it("is absent until a model call reported usage", () => {
    render();
    expect(section()).toBeNull();
  });

  it("shows the fill from the first answer, in the server's units", () => {
    // 33k raw input is mostly system prompt and tool declarations.
    usage(33_000, 1_200, 128_000);
    render();
    expect(section()?.dataset.conversationMemory).toBe("ok");
    expect(section()?.textContent).toContain("1.2k of 128k");
    expect(bar()?.getAttribute("aria-valuenow")).toBe("1");
  });

  it("keeps the explanation behind the info button, not on the card", () => {
    usage(33_000, 1_200, 128_000);
    render();
    expect(section()?.querySelector("p")).toBeNull();
    expect(about()).toContain("summarized to make room");
  });

  it("says plainly what happens as it fills, and when it is nearly full", () => {
    usage(150_000, 120_000, 128_000);
    render();
    expect(section()?.dataset.conversationMemory).toBe("nearly-full");
    expect(about()).toContain("nearly full");
    expect(about()).toContain("start a new chat");
    expect(bar()?.firstElementChild?.className).toContain("bg-warning");
  });

  it("at the ceiling says the next message compacts it, in the destructive colour", () => {
    usage(150_000, 128_000, 128_000);
    render();
    expect(section()?.dataset.conversationMemory).toBe("full");
    expect(about()).toContain("compacted with your next message");
    expect(bar()?.firstElementChild?.className).toContain("bg-destructive");
  });

  it("falls back to the raw count against a host-stated window", () => {
    (store.ref as Store).setState({
      windowTokens: 200_000,
      byThread: {
        t1: {
          inputTokens: 50_000,
          outputTokens: null,
          contextUsed: null,
          contextLimit: null,
          at: 0,
        },
      },
    });
    render();
    expect(section()?.textContent).toContain("50k of 200k");
  });
});
