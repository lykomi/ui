import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drive the two stores the picker reads. Keeping them as plain refs lets a
// test set "Auto, resolving to High" without standing up an agent runtime.
const state = vi.hoisted(() => ({
  effort: "default" as string,
  resolved: null as string | null,
  scope: null as string | null,
}));

vi.mock("zustand", () => ({
  useStore: (store: { __which: string }, selector: (s: unknown) => unknown) =>
    selector(
      store.__which === "effort"
        ? { effort: state.effort, setEffort: () => {} }
        : { resolved: state.resolved, scope: state.scope },
    ),
}));

vi.mock("@iloveagents/foundry-agent", () => ({
  reasoningEffortStore: { __which: "effort" },
  reasoningDefaultStore: { __which: "default" },
  REASONING_EFFORT_LABELS: {
    default: "Auto",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "X-High",
  },
}));

const { ReasoningEffortPicker } = await import("../reasoning-effort-picker.tsx");

describe("ReasoningEffortPicker trigger", () => {
  let container: HTMLDivElement;
  let root: Root;
  // Saved and restored: this flag is global, and leaving it set changes
  // React's act warnings for every file that runs after this one.
  let priorActEnvironment: unknown;

  beforeEach(() => {
    priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    state.effort = "default";
    state.resolved = null;
    state.scope = null;
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

  const render = () =>
    act(() => {
      root.render(<ReasoningEffortPicker />);
    });

  /** The bar gauge: the only aria-hidden group of bars in the trigger. */
  const gauge = (trigger: Element) => trigger.querySelector('[aria-hidden="true"].items-end');

  it("shows mode and level when there is room", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]");
    expect(trigger?.textContent).toContain("Auto");
    expect(trigger?.textContent).toContain("High");
  });

  it("drops the WORDS when the container is narrow and lets the gauge answer", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    // Dropping only the mode was not enough — "Medium" still cost more width
    // than a chat bubble's composer could spare. The whole label hides now.
    const hidden = trigger.querySelector(".\\@max-\\[24rem\\]\\:hidden");
    expect(hidden?.textContent).toContain("Auto");
    expect(hidden?.textContent).toContain("High");

    // ...and the gauge is NOT inside the hidden span, so the level survives.
    expect(gauge(trigger)).not.toBeNull();
    expect(hidden!.contains(gauge(trigger)!)).toBe(false);
  });

  it("shows the gauge and the words on mutually exclusive conditions", () => {
    // They are the same fact. Wide, the words name the level outright and
    // the bars would just be a second copy of it; narrow, the bars are all
    // there is room for. Exactly one shows, never both.
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    const words = trigger.querySelector(".\\@max-\\[24rem\\]\\:hidden")!;
    const bars = gauge(trigger)!.parentElement!;

    expect(words.className).toContain("@max-[24rem]:hidden");
    expect(bars.className).toContain("hidden");
    expect(bars.className).toContain("@max-[24rem]:flex");
  });

  it("lights one bar per level, on a track that shows the ceiling", () => {
    for (const [level, lit] of [
      ["low", 1],
      ["medium", 2],
      ["high", 3],
      ["xhigh", 4],
    ] as const) {
      state.effort = level;
      render();

      const bars = [
        ...gauge(container.querySelector("[data-reasoning-effort-trigger]")!)!.children,
      ];
      expect(bars.length).toBe(4);
      expect(bars.filter((b) => b.className.includes("opacity-100")).length).toBe(lit);
      // The unlit bars stay drawn: "2 of 4" is the reading, not "two marks".
      expect(bars.filter((b) => b.className.includes("opacity-25")).length).toBe(4 - lit);
    }
  });

  it("keeps the words when there is no level for the gauge to carry", () => {
    // An empty track behind hidden words leaves a narrow composer showing
    // four faint bars and a caret, with the explaining tooltip out of reach
    // on touch. `null` is not only a startup flicker — it is also a host that
    // supplies no default, a failed config load, and reasoning turned off.
    state.effort = "default";
    state.resolved = null;
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    expect(gauge(trigger)).toBeNull();
    expect(trigger.querySelector(".\\@max-\\[24rem\\]\\:hidden")).toBeNull();
    expect(trigger.textContent).toContain("Auto");
  });

  it("keeps the full label reachable when the mode is hidden", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    // Hiding is visual only — hover and screen readers still get both.
    expect(trigger.getAttribute("aria-label")).toBe("Intelligence: Auto · High");
    expect(trigger.getAttribute("title")).toBe("Intelligence: Auto · High");
  });

  it("renders a pinned level without a mode to prefix it", () => {
    state.effort = "low";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    expect(trigger.textContent).toContain("Low");
    expect(trigger.textContent).not.toContain("Auto");
    expect(trigger.getAttribute("aria-label")).toBe("Intelligence: Low");
  });

  it("says only Auto when the backend has not told us the level", () => {
    state.resolved = null;
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    // Never guess a level: an Auto that names the wrong one is worse than
    // an Auto that names none.
    expect(trigger.textContent).toContain("Auto");
    expect(trigger.getAttribute("aria-label")).toBe("Intelligence: Auto");
  });
});
