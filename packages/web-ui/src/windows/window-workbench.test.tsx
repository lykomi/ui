import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createWindowStore } from "./window-controller.ts";
import { WindowWorkbench } from "./window-workbench.tsx";

it("keeps the same editor node and scroll while switching layouts, selection and order", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const store = createWindowStore({
    tabs: ["draft", "reference"].map((id) => ({ id, title: id, close: vi.fn() })),
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowWorkbench
          controller={store}
          renderWindow={(tab) => <input aria-label={tab.id} defaultValue="draft" />}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('[aria-label="draft"]')!;
    input.value = "unsaved text";
    const scroller = input.closest<HTMLElement>("[data-window-scroll]")!;
    let offset = 120;
    // Emulate the browser: a hidden pane reports a zero scroll offset.
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => (scroller.closest("[hidden]") ? 0 : offset),
      set: (value: number) => {
        offset = value;
      },
    });
    await act(async () => scroller.dispatchEvent(new Event("scroll", { bubbles: false })));
    await act(async () => {
      store.select("reference");
    });
    await act(async () => {
      store.setLayout("panels");
      store.move("draft", 1);
      store.resize("draft", 600);
    });
    await act(async () => {
      store.setLayout("tabs");
      store.select("draft");
    });
    expect(host.querySelector('[aria-label="draft"]')).toBe(input);
    expect(input.value).toBe("unsaved text");
    expect(scroller.scrollTop).toBe(120);
    expect(host.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    const tab = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    await act(async () =>
      tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })),
    );
    expect(store.get().active).toBe("reference");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
