import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createWindowStore } from "./window-controller.ts";
import { WindowPanelActions } from "./window-panel-actions.tsx";

it("changes layout and detaches the panel only after selection is approved", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let decide!: (allowed: boolean) => void;
  const store = createWindowStore({
    tabs: ["a", "b"].map((id) => ({ id, title: id, close: vi.fn() })),
    beforeLeave: () =>
      new Promise<boolean>((resolve) => {
        decide = resolve;
      }),
  });
  store.setLayout("panels");
  const detached = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowPanelActions controller={store} tab={store.get().tabs[1]!} onShowTab={detached} />,
      ),
    );
    const show = host.querySelector<HTMLButtonElement>('[aria-label="Show b as a tab"]')!;
    await act(async () => show.click());
    expect(store.get().layout).toBe("panels");
    expect(detached).not.toHaveBeenCalled();
    await act(async () => decide(false));
    expect(store.get()).toMatchObject({ active: "a", layout: "panels" });
    expect(detached).not.toHaveBeenCalled();
    await act(async () => show.click());
    await act(async () => decide(true));
    expect(store.get()).toMatchObject({ active: "b", layout: "tabs" });
    expect(detached).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
