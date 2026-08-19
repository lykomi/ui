import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The row reads the message's own parts to count what the turn did.
const parts = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (selector: (s: unknown) => unknown) =>
    selector({ message: { parts: parts.current } }),
}));

const { TurnActivity } = await import("../turn-activity.tsx");

const tool = (ok = true) => ({
  type: "tool-call",
  status: { type: ok ? "complete" : "incomplete" },
});
const reasoning = () => ({ type: "reasoning", text: "because the clause moved" });

describe("TurnActivity — one row for what a turn did", () => {
  let container: HTMLDivElement;
  let root: Root;
  let priorActEnvironment: unknown;

  beforeEach(() => {
    priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    parts.current = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (priorActEnvironment === undefined) {
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }).IS_REACT_ACT_ENVIRONMENT;
    } else {
      globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
    }
  });

  const render = (indices: number[], isRunning = false) =>
    act(() => {
      root.render(
        <TurnActivity indices={indices} isRunning={isRunning}>
          <div data-testid="body">detail</div>
        </TurnActivity>,
      );
    });

  const label = () => container.querySelector("button")?.textContent ?? "";

  it("summarises tools and reasoning in one line", () => {
    parts.current = [reasoning(), tool(), tool(), tool()];
    render([0, 1, 2, 3]);

    expect(label()).toContain("Worked");
    expect(label()).toContain("3 tools");
    expect(label()).toContain("reasoning");
  });

  it("does not claim tools a thinking-only turn never called", () => {
    parts.current = [reasoning()];
    render([0]);

    expect(label()).toContain("reasoning");
    expect(label()).not.toContain("tool");
  });

  it("reports partial failure in the count without the alarm", () => {
    parts.current = [tool(), tool(false), tool()];
    render([0, 1, 2]);

    expect(label()).toContain("3 tools");
    expect(label()).toContain("1 failed");
    // A turn that recovered is not a red turn.
    expect(container.querySelector(".text-destructive")).toBeNull();
  });

  it("counts a failure the tool reported in its payload, not just in the status", () => {
    // The round-trip succeeded; the tool itself returned an error. Counting
    // only `status` would summarise this turn as green.
    parts.current = [
      tool(),
      { type: "tool-call", status: { type: "complete" }, result: "Error: no snapshot" },
    ];
    render([0, 1]);

    expect(label()).toContain("2 tools");
    expect(label()).toContain("1 failed");
  });

  it("earns the alarm colour only when every call failed", () => {
    parts.current = [tool(false), tool(false)];
    render([0, 1]);

    expect(container.querySelector(".text-destructive")).not.toBeNull();
  });

  it("says what it is doing while the turn runs", () => {
    parts.current = [tool(), tool()];
    render([0, 1], true);

    expect(label()).toContain("Working");
    expect(label()).toContain("2 tools");
  });

  it("names its contents rather than echoing the run-status indicator", () => {
    // A turn that has only reasoning so far renders two lines below the
    // status indicator, which already says "Thinking". Saying it again here
    // reads as a stutter rather than as two facts.
    parts.current = [reasoning()];
    render([0], true);

    expect(label()).toContain("Reasoning");
    expect(label()).not.toContain("Thinking");
  });

  it("is collapsed until asked — the answer is what the reader came for", () => {
    parts.current = [tool()];
    render([0]);

    expect(container.querySelector('[data-testid="body"]')).toBeNull();
    const click = () => {
      const trigger = container.querySelector("button")!;
      act(() => trigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    };

    click();
    expect(container.querySelector('[data-testid="body"]')).not.toBeNull();
    click();
    expect(container.querySelector('[data-testid="body"]')).toBeNull();
  });

  it("counts an unfamiliar part as work rather than losing it", () => {
    // Counted by exclusion: a future tool part type shows up in the total
    // instead of silently vanishing from the summary.
    parts.current = [{ type: "some_future_call" }, reasoning()];
    render([0, 1]);

    expect(label()).toContain("1 tool");
    expect(label()).toContain("reasoning");
  });
});
