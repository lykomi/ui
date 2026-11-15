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
  useAui: () => ({
    composer: {
      setText: (text: string) => {
        state.text = text;
      },
    },
  }),
  useAuiState: (select: (value: unknown) => unknown) => select({ composer: state }),
  ComposerPrimitive: {
    Input: ({ minRows, maxRows, ...props }: any) => (
      <textarea {...props} data-min={minRows} data-max={maxRows} />
    ),
  },
}));
import { ComposerInput } from "./composer-input.tsx";
import { chatSkillsStore } from "@lykomi/agent";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.text = "";
  chatSkillsStore.getState().setSkills(null);
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

it("selects a slash skill with the keyboard without sending the message", () => {
  chatSkillsStore.getState().setSkills([{ name: "plan-work", description: "Plan the task" }]);
  state.text = "/";
  const { container } = render(<ComposerInput />);
  act(() => container.querySelector("textarea")!.focus());
  expect(document.querySelector('[role="listbox"]')?.textContent).toContain("/plan-work");
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  act(() => container.querySelector("textarea")!.dispatchEvent(enter));
  expect(enter.defaultPrevented).toBe(true);
  expect(state.text).toBe("/plan-work ");
});
it("dismisses suggestions with Escape and hides revoked catalogue entries", () => {
  chatSkillsStore.getState().setSkills([{ name: "plan-work", description: "Plan the task" }]);
  state.text = "/";
  const { container } = render(<ComposerInput />);
  act(() => container.querySelector("textarea")!.focus());
  act(() =>
    container
      .querySelector("textarea")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
  );
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  act(() => chatSkillsStore.getState().setSkills(null));
  expect(document.querySelector('[role="listbox"]')).toBeNull();
});
