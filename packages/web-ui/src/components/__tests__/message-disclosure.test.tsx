import { act, useEffect } from "react";
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

    // The caret is the LAST child of both rows — never trailing on one and
    // leading on the other, which is how these two drifted apart originally.
    for (const row of [reasoning, activity]) {
      const last = row.lastElementChild;
      expect(last?.tagName.toLowerCase()).toBe("svg");
      expect(last?.getAttribute("class")).toContain("size-3.5");
      // ...and the row still LEADS with its meaning-carrying icon.
      expect(row.firstElementChild?.tagName.toLowerCase()).toBe("span");
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

  it("leaves every row where the model put it", async () => {
    // Rows used to be moved with flex `order` so a reasoning row would not sit
    // above a short answer. In a multi-step turn that hoist stripped the
    // model's prose out from between the work and stacked the bare rows into
    // a ladder — the exact thing the activity row exists to prevent. Nothing
    // reorders now, and no row may quietly reintroduce it.
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    expect(container.querySelector("[data-message-disclosure-reordered]")).toBeNull();
    for (const row of container.querySelectorAll("[data-message-disclosure]")) {
      expect(row.className).not.toContain("order-");
    }
  });

  it("starts both rows folded, so the answer is what the reader sees", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    // Folded means not on screen. The activity row keeps its cards MOUNTED
    // (see the next test) so it hides them rather than dropping them; the
    // reasoning row has nothing to run and drops its text outright.
    const details = container.querySelector('[data-testid="details"]');
    expect(details?.closest("[hidden]")).not.toBeNull();
    expect(container.textContent).not.toContain("because of the clause");
    // …and both still announce what they are.
    expect(container.textContent).toContain("Reasoning");
    expect(container.textContent).toContain("Worked · 1 tool");
  });

  it("still MOUNTS the cards it folds away, because a tool card does things", async () => {
    // A tool UI is not only a picture of a result. `ShowDocumentToolUI` opens
    // the side panel when its result lands, and a graph card folds the result
    // into the graph already on screen. Unmounted, none of that runs — so a
    // row that is closed by default silently decided that no result was ever
    // acted on. Seen live: an expansion the agent narrated and the graph
    // panel never received.
    parts.current = [{ status: { type: "complete" } }];
    let ran = 0;
    const Card = () => {
      useEffect(() => {
        ran += 1;
      }, []);
      return <div data-testid="card">card</div>;
    };

    await act(async () => {
      root.render(
        <TurnActivity indices={[0]} isRunning={false}>
          <Card />
        </TurnActivity>,
      );
    });

    expect(ran).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="card"]')).not.toBeNull();
  });

  it("rotates the same caret rather than swapping the glyph", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    // A TRAILING caret rests pointing down ("opens downward") and flips to
    // point up when open — the opposite rest position from a leading one,
    // which points right and turns 90° to point at the content. Moving the
    // caret without changing the rotation would leave it pointing sideways
    // at nothing.
    const caret = () => triggers()[1].lastElementChild?.getAttribute("class") ?? "";
    expect(caret()).not.toContain("rotate-180");

    await act(async () => {
      triggers()[1].click();
    });
    expect(caret()).toContain("rotate-180");
  });

  it("lines the row up with the message text instead of 6px inside it", async () => {
    // The row is a pill with its own padding; without cancelling that
    // padding the icon sits indented from the prose above and below it.
    parts.current = [{ status: { type: "complete" } }];
    await renderBoth();

    for (const row of triggers()) {
      expect(row.className).toContain("-ml-1.5");
      expect(row.className).toContain("px-1.5");
    }
  });
});
