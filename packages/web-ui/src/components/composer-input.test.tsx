import { afterEach, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
const cleanups: (() => void)[] = [];
function cleanup() {
  cleanups.splice(0).forEach((fn) => fn());
}
function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const rerender = (node: ReactNode) => act(() => root.render(node));
  let mounted = true;
  const unmount = () => {
    if (mounted) {
      act(() => root.unmount());
      container.remove();
      mounted = false;
    }
  };
  cleanups.push(unmount);
  rerender(element);
  return { container, rerender, unmount };
}
const state = vi.hoisted(() => ({ text: "" }));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (select: (value: unknown) => unknown) => select({ composer: state }),
  ComposerPrimitive: {
    Input: ({ minRows, maxRows, ...props }: any) => (
      <textarea {...props} data-min={minRows} data-max={maxRows} />
    ),
  },
}));
import { ComposerInput } from "./composer-input.tsx";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.text = "";
});
it("keeps empty input to one row and restores the caller's limit while typing", () => {
  const { container, rerender } = render(<ComposerInput maxRows={8} />);
  const input = container.querySelector("textarea")!;
  expect(input.dataset.max).toBe("1");
  state.text = "draft";
  rerender(<ComposerInput maxRows={8} />);
  expect(input.dataset.max).toBe("8");
  state.text = "";
  rerender(<ComposerInput maxRows={8} />);
  expect(input.dataset.max).toBe("1");
});
it("remeasures on pane width changes without replacing the input", () => {
  let notify: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const { container, unmount } = render(<ComposerInput />);
  const input = container.querySelector("textarea")!;
  act(() => notify([{ contentRect: { width: 300 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(input.dataset.composerWidth).toBe("300");
  act(() => notify([{ contentRect: { width: 0 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(input.dataset.composerWidth).toBe("300");
  act(() => notify([{ contentRect: { width: 500 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(container.querySelector("textarea")).toBe(input);
  expect(input.dataset.composerWidth).toBe("500");
  unmount();
  expect(disconnect).toHaveBeenCalled();
});
