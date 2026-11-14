import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TeachingBubbleHost } from "../../components/teaching-bubble-host.tsx";
import { getGuidanceTargets, showTeachingBubble } from "../teaching-bubble-store.ts";

it("renders an unclipped ring outside the toolbar and a functional bubble", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  document.body.innerHTML =
    '<div data-working-content style="overflow:hidden"><button>New space</button></div><div id="root"></div>';
  const target = document.querySelector("button")!;
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: 50,
    y: 60,
    top: 60,
    left: 50,
    width: 100,
    height: 32,
    right: 150,
    bottom: 92,
    toJSON() {},
  });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(<TeachingBubbleHost />));
    const snapshot = getGuidanceTargets();
    await act(async () => {
      showTeachingBubble({
        snapshotId: snapshot.snapshotId,
        targetId: snapshot.targets?.[0].targetId,
        title: "Create a space",
        message: "Start here.",
      });
    });
    const ring = document.querySelector<HTMLElement>("[data-teaching-ring]")!;
    expect(ring).not.toBeNull();
    expect(ring.closest("[data-working-content]")).toBeNull();
    expect(ring.style.left).toBe("46px");
    expect(ring.style.width).toBe("108px");
    expect(document.body.textContent).toContain("Start here.");
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[aria-label="Close guidance"]')!.click();
    });
    expect(document.querySelector("[data-teaching-ring]")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
