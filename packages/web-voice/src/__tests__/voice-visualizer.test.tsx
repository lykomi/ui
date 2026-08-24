/**
 * The static visualiser — no analyser, or reduced motion — has no animation
 * loop, so anything that clears or invalidates the canvas has to repaint it
 * explicitly. Both failures below were live in untested code.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VoiceVisualizer } from "../react/voice-visualizer.tsx";

/** Counts paints: every draw() opens at least one path. */
let paints = 0;
let resizeCallback: (() => void) | null = null;

const fakeCtx = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(() => {
    paints++;
  }),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  save: vi.fn(),
  restore: vi.fn(),
  set strokeStyle(_v: unknown) {},
  set fillStyle(_v: unknown) {},
  set lineWidth(_v: unknown) {},
  set globalAlpha(_v: unknown) {},
  set lineCap(_v: unknown) {},
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let priorAct: boolean | undefined;

beforeAll(() => {
  priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => fakeCtx,
  ) as unknown as HTMLCanvasElement["getContext"];
  // A zero-sized canvas makes resize() bail before it clears anything.
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 300,
    height: 300,
    top: 0,
    left: 0,
    right: 300,
    bottom: 300,
    x: 0,
    y: 0,
  })) as unknown as HTMLElement["getBoundingClientRect"];
});

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
  vi.unstubAllGlobals();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  resizeCallback = null;
  paints = 0;
});

/** Mounts inside a ThemeScope-like wrapper: the theme lives on an ANCESTOR. */
async function mountStatic() {
  host = document.createElement("div");
  const themeScope = document.createElement("div");
  host.appendChild(themeScope);
  document.body.appendChild(host);
  root = createRoot(themeScope);
  // analyser: null -> the static path, no requestAnimationFrame loop.
  await act(async () => root!.render(<VoiceVisualizer analyser={null} />));
  return themeScope;
}

describe("VoiceVisualizer (static path)", () => {
  it("repaints after a resize", async () => {
    await mountStatic();
    expect(paints).toBeGreaterThan(0);

    paints = 0;
    expect(resizeCallback).not.toBeNull();
    // A resize assigns canvas.width/height, which clears the backing store.
    // With no animation loop nothing else would ever repaint it, so the idle
    // indicator vanished until an unrelated rerender happened along.
    await act(async () => resizeCallback!());

    expect(paints).toBeGreaterThan(0);
  });

  it("repaints when a theme layer changes on an ancestor, not just on <html>", async () => {
    // foundry's ThemeScope applies runtime theme variables as an inline style
    // on a wrapper div between the canvas and the root. An observer watching
    // only document.documentElement never sees it, so the static canvas kept
    // painting the previous palette.
    const themeScope = await mountStatic();
    paints = 0;

    await act(async () => {
      themeScope.setAttribute("style", "--primary: #ff0000");
      // MutationObserver callbacks are microtasks; let them run.
      await Promise.resolve();
    });

    expect(paints).toBeGreaterThan(0);
  });
});
