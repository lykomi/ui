import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PaneResizeHandle } from "./pane-resize-handle.tsx";

it("shares keyboard resizing, reset and pointer cancellation across panel edges", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const resize = vi.fn();
  try {
    await act(async () =>
      root.render(
        <div>
          <PaneResizeHandle
            label="structure"
            width={320}
            defaultWidth={288}
            min={224}
            max={544}
            onResize={resize}
          />
        </div>,
      ),
    );
    const handle = host.querySelector<HTMLElement>('[role="separator"]')!;
    handle.parentElement!.getBoundingClientRect = () => ({ width: 320 }) as DOMRect;
    handle.setPointerCapture = vi.fn();
    await act(async () =>
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(resize).toHaveBeenLastCalledWith(352);
    await act(async () =>
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })),
    );
    expect(resize).toHaveBeenLastCalledWith();
    await act(async () =>
      handle.dispatchEvent(
        new MouseEvent("pointerdown", { button: 0, clientX: 100, bubbles: true }),
      ),
    );
    await act(async () =>
      handle.dispatchEvent(new MouseEvent("pointermove", { clientX: 900, bubbles: true })),
    );
    expect(resize).toHaveBeenLastCalledWith(544);
    await act(async () => handle.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true })));
    expect(resize).toHaveBeenLastCalledWith(320);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
