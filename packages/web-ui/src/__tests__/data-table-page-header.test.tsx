import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DataTablePageHeader } from "../components/data-table/data-table-page-header.tsx";

it("keeps a visual page header aligned with horizontally scrolling columns", async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  class Observer {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", Observer);
  let headerBottom = 140;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const height = this.hasAttribute("data-original-header") ? 40 : 600;
    const bottom = this.hasAttribute("data-original-header") ? headerBottom : 900;
    return {
      x: 0,
      y: bottom - height,
      top: bottom - height,
      bottom,
      left: 0,
      right: 600,
      width: 600,
      height,
      toJSON() {
        return {};
      },
    };
  });

  function Fixture() {
    const root = useRef<HTMLDivElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const header = useRef<HTMLTableSectionElement>(null);
    return (
      <div ref={root} data-list-root="">
        <DataTablePageHeader root={root} scroller={scroller} header={header} offset={100} />
        <div ref={scroller} data-list-scroller="">
          <table style={{ width: 900 }}>
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 700 }} />
            </colgroup>
            <thead ref={header} data-original-header="">
              <tr>
                <th data-pinned="header" style={{ width: 200 }}>
                  Name
                </th>
                <th style={{ width: 700 }}>Assessment</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  try {
    await act(async () => root.render(<Fixture />));
    await act(async () => flush());
    const mirror = host.querySelector<HTMLElement>("[data-page-table-header]")!;
    const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
    const table = mirror.querySelector<HTMLTableElement>("table")!;
    expect(mirror.style.visibility).toBe("hidden");
    expect(mirror.getAttribute("aria-hidden")).toBe("true");
    expect(table.textContent).toContain("Assessment");
    expect(table.style.width).toBe("900px");

    headerBottom = 80;
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      flush();
    });
    expect(mirror.style.visibility).toBe("visible");
    scroller.scrollLeft = 220;
    await act(async () => {
      scroller.dispatchEvent(new Event("scroll"));
      flush();
    });
    expect(table.style.transform).toBe("translate3d(-220px, 0, 0)");
    expect(table.querySelector<HTMLElement>('[data-pinned="header"]')?.style.transform).toBe(
      "translate3d(220px, 0, 0)",
    );

    headerBottom = 140;
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      flush();
    });
    expect(mirror.style.visibility).toBe("hidden");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
