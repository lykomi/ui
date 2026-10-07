import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useTableViewport } from "../components/data-table/use-table-viewport.ts";

it.each(["auto", "hidden", "clip"])("refits through a distant %s boundary", async (overflow) => {
  const observed = new Set<Element>();
  let resize: () => void = () => {};
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe(element: Element) {
        observed.add(element);
      }
      unobserve(element: Element) {
        observed.delete(element);
      }
      disconnect() {
        observed.clear();
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  vi.stubGlobal("innerHeight", 1000);
  const pane = document.createElement("div");
  pane.style.overflowY = "auto";
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-table-layout", "");
  const tableFrame = document.createElement("div");
  const scroller = document.createElement("div");
  const footer = document.createElement("div");
  footer.setAttribute("data-table-overflow", "");
  tableFrame.append(scroller, footer);
  wrapper.append(tableFrame);
  pane.append(wrapper);
  const outer = document.createElement("div");
  outer.style.overflowY = overflow;
  outer.append(pane);
  document.body.append(outer);
  let outerHeight = 900;
  Object.defineProperties(outer, {
    clientHeight: { get: () => outerHeight },
    scrollHeight: { get: () => 850 },
  });
  outer.getBoundingClientRect = () => ({ top: 0, width: 400, height: outerHeight }) as DOMRect;
  let paneHeight = 700;
  let contentHeight = 600;
  Object.defineProperties(pane, {
    clientHeight: { get: () => paneHeight },
    scrollHeight: { get: () => contentHeight },
  });
  const rect = (top: number, height: number) =>
    ({ top, bottom: top + height, height, width: 400 }) as DOMRect;
  pane.getBoundingClientRect = () => rect(100, paneHeight);
  let scrollerHeight = 500;
  scroller.getBoundingClientRect = () => rect(200, scrollerHeight);
  tableFrame.getBoundingClientRect = () => rect(200, scrollerHeight + 20);
  footer.getBoundingClientRect = () => rect(700, 20);
  const host = document.createElement("div");
  const root = createRoot(host);
  function Probe({ enabled = true, fit = true }: { enabled?: boolean; fit?: boolean }) {
    const ref = useRef(scroller);
    const viewport = useTableViewport(ref, enabled, fit);
    return <output data-paginated={viewport.paginated}>{viewport.height ?? "unbounded"}</output>;
  }
  try {
    await act(async () => root.render(<Probe />));
    expect(host.textContent).toBe("732");
    expect(observed.has(pane)).toBe(true);
    paneHeight = 400;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("232");
    // Fitting the table can remove the ancestor overflow; keep its boundary.
    contentHeight = 300;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("232");
    outerHeight = 450;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("182");
    outer.style.overflowY = "visible";
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      frame?.(0);
    });
    expect(host.textContent).toBe("232");
    pane.style.overflowY = "visible";
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("732");
    outer.style.overflowY = overflow;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("182");
    const paging = document.createElement("div");
    paging.setAttribute("data-table-footer", "");
    paging.setAttribute("data-table-pagination", "");
    let pagingHeight = 72;
    paging.getBoundingClientRect = () =>
      rect(tableFrame.getBoundingClientRect().bottom + 12, pagingHeight);
    await act(async () => {
      wrapper.append(paging);
      await Promise.resolve();
      frame?.(0);
    });
    expect(host.textContent).toBe("130");
    expect(observed.has(paging)).toBe(true);
    await act(async () => root.render(<Probe fit={false} />));
    expect(host.textContent).toBe("unbounded");
    expect(host.firstElementChild?.getAttribute("data-paginated")).toBe("true");
    await act(async () => root.render(<Probe />));
    expect(host.firstElementChild?.getAttribute("data-paginated")).toBe("true");
    pagingHeight = 120;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("82");
    await act(async () => {
      paging.remove();
      await Promise.resolve();
      frame?.(0);
    });
    expect(host.textContent).toBe("182");
    expect(observed.has(paging)).toBe(false);
    expect(host.firstElementChild?.getAttribute("data-paginated")).toBe("false");
    outerHeight = 260;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("0");
    scrollerHeight = 0;
    outerHeight = 450;
    await act(async () => {
      resize();
      frame?.(0);
    });
    expect(host.textContent).toBe("182");
    await act(async () => root.render(<Probe enabled={false} />));
    expect(host.textContent).toBe("unbounded");
    expect(observed.size).toBe(0);
  } finally {
    await act(async () => root.unmount());
    outer.remove();
    vi.unstubAllGlobals();
  }
});
