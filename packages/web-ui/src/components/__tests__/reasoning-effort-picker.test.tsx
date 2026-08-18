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

  beforeEach(() => {
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
  });

  const render = () =>
    act(() => {
      root.render(<ReasoningEffortPicker />);
    });

  it("shows mode and level when there is room", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]");
    expect(trigger?.textContent).toContain("Auto");
    expect(trigger?.textContent).toContain("High");
  });

  it("drops only the MODE when the container is narrow, never the level", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    // The mode is the half that hides; the level has no hiding class, so a
    // narrow composer still answers "what am I running?".
    const hidden = trigger.querySelector(".\\@max-\\[24rem\\]\\:hidden");
    expect(hidden?.textContent).toContain("Auto");
    expect(hidden?.textContent).not.toContain("High");
  });

  it("keeps the full label reachable when the mode is hidden", () => {
    state.resolved = "high";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    // Hiding is visual only — hover and screen readers still get both.
    expect(trigger.getAttribute("aria-label")).toBe("Intelligence: Auto · High");
    expect(trigger.getAttribute("title")).toBe("Intelligence: Auto · High");
  });

  it("renders a pinned level with nothing to hide", () => {
    state.effort = "low";
    render();

    const trigger = container.querySelector("[data-reasoning-effort-trigger]")!;
    expect(trigger.textContent).toContain("Low");
    expect(trigger.querySelector(".\\@max-\\[24rem\\]\\:hidden")).toBeNull();
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
