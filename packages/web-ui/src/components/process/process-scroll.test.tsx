import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProcessSteps } from "./process-steps.tsx";

let host: HTMLDivElement, root: Root, position: number, width: number, rtl: boolean;
let resize: () => void;
const scrollBy = vi.fn();
const steps = ["Documents", "Analysis", "Review"].map((label, index) => ({
  id: String(index),
  label,
  status: "ready" as const,
  selectable: true,
}));
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  position = 0;
  width = 600;
  rtl = false;
  scrollBy.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("getComputedStyle", (element: HTMLElement) => ({
    flexDirection: element.closest('[data-orientation="vertical"]') ? "column" : "row",
    direction: rtl ? "rtl" : "ltr",
  }));
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () {
    return this.classList.contains("foundry-process-scroller") ? width : width - 100;
  });
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(912);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const item = this.closest("li");
    const index = item ? [...item.parentElement!.children].indexOf(item) : -1;
    const left =
      index < 0 ? 0 : rtl ? width - 100 - 308 - index * 300 - position : 8 + index * 300 - position;
    const size = index < 0 ? width - 100 : 300;
    return {
      left,
      right: left + size,
      width: size,
      top: 0,
      bottom: 64,
      height: 64,
      x: left,
      y: 0,
      toJSON() {},
    };
  });
  Object.defineProperty(HTMLElement.prototype, "scrollBy", {
    configurable: true,
    value: scrollBy.mockImplementation(({ left }: { left: number }) => {
      position += left;
    }),
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollBy;
});
it("offers named overflow controls without advancing or selecting a step", () => {
  const select = vi.fn();
  act(() =>
    root.render(
      <ProcessSteps
        steps={steps}
        orientation="horizontal"
        currentStepId="0"
        onStepSelect={select}
        scrollLabels={{ previous: "Zurück scrollen", next: "Weiter scrollen" }}
      />,
    ),
  );
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Zurück scrollen"]')?.disabled).toBe(
    true,
  );
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Weiter scrollen"]')!.click());
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 400, behavior: "auto" });
  expect(select).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Documents");
  act(() => host.querySelector(".foundry-process-viewport")!.dispatchEvent(new Event("scroll")));
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Zurück scrollen"]')?.disabled).toBe(
    false,
  );
  const calls = scrollBy.mock.calls.length;
  act(() => host.querySelector(".foundry-process-viewport")!.dispatchEvent(new Event("scroll")));
  expect(scrollBy).toHaveBeenCalledTimes(calls);
});
it("reveals a newly inspected step in the rail and removes controls when it fits", () => {
  act(() => root.render(<ProcessSteps steps={steps} currentStepId="0" />));
  scrollBy.mockClear();
  act(() => root.render(<ProcessSteps steps={steps} currentStepId="0" selectedStepId="2" />));
  expect(scrollBy).toHaveBeenCalledWith({ left: 416, behavior: "auto" });
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Documents");
  width = 1200;
  act(() => resize());
  expect(host.querySelector(".foundry-process-scroll-button")).toBeNull();
  expect(host.querySelector(".foundry-process-viewport")?.getAttribute("tabindex")).toBeNull();
});
it("supports RTL and keyboard scrolling of passive progress without moving the page", () => {
  rtl = true;
  act(() => root.render(<ProcessSteps steps={steps} orientation="horizontal" />));
  scrollBy.mockClear();
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Show next steps"]')!.click());
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -400, behavior: "auto" });
  act(() =>
    host
      .querySelector(".foundry-process-viewport")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
  );
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 400, behavior: "auto" });
});
it("does not turn a vertical rail into a horizontal scroller", () => {
  act(() => root.render(<ProcessSteps steps={steps} orientation="vertical" currentStepId="2" />));
  expect(host.querySelector(".foundry-process-scroll-button")).toBeNull();
  expect(scrollBy).not.toHaveBeenCalled();
});
