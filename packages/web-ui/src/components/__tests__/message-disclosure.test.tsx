import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The activity row counts failures from the message's parts; stub that hook so
// both foldaways can be rendered side by side without an assistant runtime.
const parts = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (selector: (s: unknown) => unknown) =>
    selector({ message: { parts: parts.current } }),
}));

const { TurnActivity } = await import("../turn-activity.tsx");
const { ReasoningPart } = await import("../reasoning-part.tsx");

/**
 * A standalone reasoning row and a turn's activity row are the same affordance
 * and can sit next to each other in one message. Built separately they
 * drifted: one caret pointed down on the RIGHT of its label, the other pointed
 * right on the LEFT of its own, with different paddings — two
 * unrelated-looking widgets stacked together.
 *
 * These tests pin the shared shape, not the pixels.
 */
describe("message foldaways share one row shape", () => {
  let container: HTMLDivElement;
  let root: Root;

  let priorActEnvironment: unknown;

  beforeEach(() => {
    priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  const renderBoth = () =>
    act(() => {
      root.render(
        <>
          <ReasoningPart text="because of the clause" />
          <TurnActivity indices={[0]} isRunning={false}>
            <div data-testid="details">details</div>
          </TurnActivity>
        </>,
      );
    });

  const triggers = () => [...container.querySelectorAll<HTMLElement>("[data-disclosure-trigger]")];

  it("gives both rows the same metrics and the same caret", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    const [reasoning, activity] = triggers();
    expect(reasoning).toBeTruthy();
    expect(activity).toBeTruthy();

    // Same padding, size and alignment — the drift that made them look like
    // two different controls.
    for (const cls of ["px-1.5", "py-0.5", "text-xs", "items-center", "gap-1.5"]) {
      expect(reasoning.className).toContain(cls);
      expect(activity.className).toContain(cls);
    }

    // The caret is the FIRST child of both rows — never trailing on one and
    // leading on the other.
    for (const row of [reasoning, activity]) {
      const first = row.firstElementChild;
      expect(first?.tagName.toLowerCase()).toBe("svg");
      expect(first?.getAttribute("class")).toContain("size-3.5");
    }
  });

  it("closes the gap when one row follows another", async () => {
    // The message wraps parts in gap-4. Left alone, two 20px meta rows put
    // 64px of chrome above a one-line answer.
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    // Every in-flow row carries the rule; a trailing row deliberately does not.
    const inFlow = [...container.querySelectorAll("[data-message-disclosure]")];
    expect(inFlow.length).toBeGreaterThan(0);
    for (const row of inFlow) {
      expect(row.className).toContain("[[data-message-disclosure]_+_&]:-mt-3");
    }
  });

  it("puts a reordered row under the in-flow ones and above the answer", async () => {
    // A standalone reasoning row arrives above the work in the DOM, because
    // the model emits its thinking FIRST. A reader wants "what it did" before
    // "why", so the row moves visually — and, because the compaction is a
    // DOM-sibling rule, it must NOT carry the attribute that rule chains on.
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    const reasoningRoot = container.querySelector("[data-message-disclosure-reordered]");
    expect(reasoningRoot).toBeTruthy();
    // order-1 sits it after the in-flow rows (order-0) and before the answer
    // text (order-2) — not after the answer, which would end the message on
    // its machinery instead of its point.
    expect(reasoningRoot?.className).toContain("order-1");
    expect(reasoningRoot?.className).not.toContain("order-last");

    // The activity row stays in flow and keeps the attribute the gap rule
    // uses, so two turns' worth of machinery compact together.
    const activityRoot = container.querySelector("[data-message-disclosure]");
    expect(activityRoot).toBeTruthy();
    expect(activityRoot?.className).not.toContain("order-1");
  });

  it("starts both rows folded, so the answer is what the reader sees", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    expect(container.querySelectorAll('[data-testid="details"]').length).toBe(0);
    expect(container.textContent).not.toContain("because of the clause");
    // …and both still announce what they are.
    expect(container.textContent).toContain("Reasoning");
    expect(container.textContent).toContain("Worked · 1 tool");
  });

  it("rotates the same caret rather than swapping the glyph", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    const caret = () => triggers()[1].firstElementChild?.getAttribute("class") ?? "";
    expect(caret()).not.toContain("rotate-90");

    await act(async () => {
      triggers()[1].click();
    });
    expect(caret()).toContain("rotate-90");
  });
});
