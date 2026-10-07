import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useTableViewport } from "../components/data-table/use-table-viewport.ts";

it("refits when a distant scroll pane shrinks before its first overflow", async () => {
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
  const tableFrame = document.createElement("div");
  const scroller = document.createElement("div");
  const footer = document.createElement("div");
  footer.setAttribute("data-table-overflow", "");
  tableFrame.append(scroller, footer);
  wrapper.append(tableFrame);
  pane.append(wrapper);
  const outer = document.createElement("div");
  outer.style.overflowY = "auto";
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
  const rect = (top: number, height: number) => ({ top, height, width: 400 }) as DOMRect;
  pane.getBoundingClientRect = () => rect(100, paneHeight);
  scroller.getBoundingClientRect = () => rect(200, 500);
  footer.getBoundingClientRect = () => rect(700, 20);
  const host = document.createElement("div");
  const root = createRoot(host);
  function Probe({ enabled = true }: { enabled?: boolean }) {
    const ref = useRef(scroller);
    const height = useTableViewport(ref, enabled);
    return <output>{height ?? "unbounded"}</output>;
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
    await act(async () => root.render(<Probe enabled={false} />));
    expect(host.textContent).toBe("unbounded");
    expect(observed.size).toBe(0);
  } finally {
    await act(async () => root.unmount());
    outer.remove();
    vi.unstubAllGlobals();
  }
});
