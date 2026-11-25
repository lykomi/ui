import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createWindowStore } from "./window-controller.ts";
import { WindowWorkbench } from "./window-workbench.tsx";
import { WindowTabStrip } from "./window-tab-strip.tsx";

it("discloses the full label and context when arrow navigation focuses a tab", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const tabs = [
    { id: "overview", title: "Overview", close: vi.fn() },
    { id: "brief", title: "A long project brief title", close: vi.fn() },
  ];
  const store = createWindowStore({ tabs, active: "overview" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowTabStrip
          controller={store}
          tabs={tabs}
          active="overview"
          description={(tab) => (tab.id === "brief" ? "Project › Planning" : undefined)}
        />,
      ),
    );
    const overview = host.querySelector<HTMLButtonElement>("#tab-overview")!;
    const brief = host.querySelector<HTMLButtonElement>("#tab-brief")!;
    await act(async () =>
      overview.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(document.activeElement).toBe(brief);
    expect(store.get().active).toBe("brief");
    const tooltip = document.getElementById(brief.getAttribute("aria-describedby")!)!;
    expect(tooltip.textContent).toBe("Project › Planning");
    expect(tooltip.parentElement?.textContent).toContain("A long project brief title");
    await act(async () => brief.blur());
    expect(brief.hasAttribute("aria-describedby")).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

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

it("closing an inactive panel preserves the active working context", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const store = createWindowStore();
  ["a", "b", "c"].forEach((id) =>
    store.open({ id, title: id, close: () => store.remove(id) }, { mode: "new-tab" }),
  );
  store.setLayout("panels");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowWorkbench controller={store} renderWindow={(tab) => <p>{tab.title}</p>} />,
      ),
    );
    const close = host.querySelector<HTMLButtonElement>('[aria-label="Close a"]')!;
    await act(async () => {
      close.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      close.focus();
    });
    expect(store.get().active).toBe("c");
    await act(async () => close.click());
    expect(store.get().active).toBe("c");
    expect(store.get().tabs.map((tab) => tab.id)).toEqual(["b", "c"]);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("coalesces pointer and focus activation while awaiting one leave decision", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let decide!: (allowed: boolean) => void;
  const guard = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        decide = resolve;
      }),
  );
  const store = createWindowStore({
    tabs: ["a", "b"].map((id) => ({ id, title: id, close: vi.fn() })),
    beforeLeave: guard,
  });
  store.setLayout("panels");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowWorkbench
          controller={store}
          renderWindow={(tab) => <input aria-label={`Edit ${tab.id}`} />}
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('[aria-label="Edit b"]')!;
    await act(async () => {
      input.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      input.focus();
    });
    expect(guard).toHaveBeenCalledOnce();
    expect(store.get().active).toBe("a");
    await act(async () => decide(true));
    expect(store.get().active).toBe("b");
    await act(async () => host.querySelector<HTMLInputElement>('[aria-label="Edit a"]')!.focus());
    expect(guard).toHaveBeenCalledTimes(2);
    await act(async () => decide(true));
    expect(store.get().active).toBe("a");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});

it("reveals the active panel within its workbench without scrolling the host page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const store = createWindowStore({
    tabs: ["a", "b"].map((id) => ({ id, title: id, close: vi.fn() })),
  });
  store.setLayout("panels");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <WindowWorkbench controller={store} renderWindow={(tab) => <p>{tab.title}</p>} />,
      ),
    );
    const viewport = host.querySelector<HTMLElement>('[data-window-layout="panels"]')!;
    const panes = host.querySelectorAll<HTMLElement>('[role="tabpanel"]');
    Object.defineProperty(viewport, "clientHeight", { value: 300 });
    panes.forEach((pane, index) => {
      Object.defineProperties(pane, {
        offsetTop: { value: index * 320 },
        offsetHeight: { value: 300 },
      });
    });
    host.scrollTop = 120;
    await act(async () => {
      store.select("b");
    });
    expect(viewport.scrollTop).toBe(320);
    expect(host.scrollTop).toBe(120);
    await act(async () => {
      store.select("a");
    });
    expect(viewport.scrollTop).toBe(0);
    expect(host.scrollTop).toBe(120);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
