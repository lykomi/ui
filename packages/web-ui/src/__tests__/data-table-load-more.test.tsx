import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { DataTableLoadMore } from "../components/data-table/data-table-load-more.tsx";
let root: Root;
let container: HTMLDivElement;
let notify: IntersectionObserverCallback;
let options: IntersectionObserverInit | undefined;
const scroller = createRef<HTMLDivElement>();
function mount(load: () => Promise<unknown>, rowCount = 20) {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback, config: IntersectionObserverInit) {
        notify = callback;
        options = config;
      }
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const render = (count: number) =>
    act(() =>
      root.render(
        <DataTableLoadMore
          options={{ hasMore: true, onLoadMore: load }}
          rowCount={count}
          scroller={scroller}
          pageScrolling={false}
        />,
      ),
    );
  render(rowCount);
  return render;
}
async function intersect() {
  await act(async () =>
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
  );
}
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});
it("loads once per progress position and rearms when rows append", async () => {
  const load = vi.fn(async () => {});
  const render = mount(load);
  expect(options?.root).toBe(scroller.current);
  await intersect();
  await intersect();
  expect(load).toHaveBeenCalledTimes(1);
  render(40);
  await intersect();
  expect(load).toHaveBeenCalledTimes(2);
});
it("shows a retry after failure without an automatic retry loop", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
  mount(load);
  await intersect();
  await intersect();
  expect(load).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  await act(async () => container.querySelector("button")!.click());
  expect(load).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
