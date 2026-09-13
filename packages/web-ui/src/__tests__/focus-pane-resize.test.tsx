import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { FocusPaneResize } from "../components/data-table/focus-pane-resize.tsx";

it.each(["left", "right"] as const)(
  "resizes the %s edge with keyboard and resets without remounting",
  async (side) => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const pane = document.createElement("aside");
    dialog.append(pane);
    document.body.append(dialog);
    dialog.getBoundingClientRect = () => ({ width: 1200 }) as DOMRect;
    pane.getBoundingClientRect = () => ({ width: 400 }) as DOMRect;
    const resize = vi.fn();
    const root = createRoot(pane);
    try {
      await act(async () =>
        root.render(<FocusPaneResize label="source" side={side} width={400} onResize={resize} />),
      );
      const handle = pane.querySelector('[role="separator"]')!;
      await act(async () => {
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      });
      expect(resize).toHaveBeenLastCalledWith(side === "right" ? 432 : 368);
      await act(async () => {
        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      });
      expect(resize).toHaveBeenLastCalledWith();
      expect(pane.querySelector('[role="separator"]')).toBe(handle);
    } finally {
      await act(async () => root.unmount());
      dialog.remove();
    }
  },
);

it("excludes nested inspectors and bounds an automatic source width", async () => {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  const chat = document.createElement("aside");
  const main = document.createElement("main");
  const inspector = document.createElement("aside");
  main.append(inspector);
  const source = document.createElement("aside");
  dialog.append(chat, main, source);
  document.body.append(dialog);
  dialog.getBoundingClientRect = () => ({ width: 1280 }) as DOMRect;
  chat.getBoundingClientRect = () => ({ width: 640 }) as DOMRect;
  inspector.getBoundingClientRect = () => ({ width: 320 }) as DOMRect;
  source.getBoundingClientRect = () => ({ width: 512 }) as DOMRect;
  const resize = vi.fn();
  const root = createRoot(source);
  try {
    await act(async () =>
      root.render(<FocusPaneResize label="source" side="left" onResize={resize} />),
    );
    expect(source.querySelector('[role="separator"]')?.getAttribute("aria-valuemax")).toBe("320");
    expect(resize).toHaveBeenLastCalledWith(320);
  } finally {
    await act(async () => root.unmount());
    dialog.remove();
  }
});
