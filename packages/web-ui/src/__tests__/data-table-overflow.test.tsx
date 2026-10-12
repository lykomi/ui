import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  DataTableOverflow,
  DATA_TABLE_PAGE_OVERFLOW_HEIGHT,
  DATA_TABLE_PAGE_OVERFLOW_WIDTH,
} from "../components/data-table/data-table-overflow.tsx";

it("navigates overflowing columns and updates the available directions", async () => {
  const element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 400 }, scrollWidth: { value: 1000 } });
  element.scrollBy = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DataTableOverflow scroller={{ current: element }} />));
    expect(host.textContent).toContain("Scroll to see more columns");
    expect(
      (host.querySelector('[aria-label="Previous columns"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    await act(async () =>
      (host.querySelector('[aria-label="Next columns"]') as HTMLButtonElement).click(),
    );
    expect(element.scrollBy).toHaveBeenCalledWith({ left: 280, behavior: "auto" });
    await act(async () => {
      element.scrollLeft = 600;
      element.dispatchEvent(new Event("scroll"));
    });
    expect((host.querySelector('[aria-label="Next columns"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (host.querySelector('[aria-label="Previous columns"]') as HTMLButtonElement).disabled,
    ).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("adds navigation without a second horizontal scrollport", async () => {
  const element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 400 }, scrollWidth: { value: 1000 } });
  element.scrollTop = 180;
  element.scrollBy = vi.fn(({ left }: { left: number }) => {
    element.scrollLeft += left;
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DataTableOverflow scroller={{ current: element }} />));
    expect(host.querySelector('[aria-label="Horizontal column scrollbar"]')).toBeNull();
    expect(host.querySelector("[data-list-scroller]")).toBeNull();
    await act(async () =>
      (host.querySelector('[aria-label="Next columns"]') as HTMLButtonElement).click(),
    );
    expect(element.scrollLeft).toBe(280);
    expect(element.scrollTop).toBe(180);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("keeps page navigation inside the header height on narrow tables", async () => {
  const element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 400 }, scrollWidth: { value: 800 } });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<DataTableOverflow scroller={{ current: element }} compact stickyTop={64} />),
    );
    const navigation = host.querySelector("[data-table-overflow]") as HTMLElement;
    const controls = host.querySelector('[role="group"]') as HTMLElement;
    expect(navigation.style.height).toBe(`${DATA_TABLE_PAGE_OVERFLOW_HEIGHT}px`);
    expect(navigation.style.marginBottom).toBe(`-${DATA_TABLE_PAGE_OVERFLOW_HEIGHT}px`);
    expect(controls.style.width).toBe(`${DATA_TABLE_PAGE_OVERFLOW_WIDTH}px`);
    expect(host.querySelector('[aria-label="Previous columns"]')).toBeNull();
    expect(host.querySelector('[aria-label="Next columns"]')).not.toBeNull();
    await act(async () => {
      element.scrollLeft = 400;
      element.dispatchEvent(new Event("scroll"));
    });
    expect(host.querySelector('[aria-label="Previous columns"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Next columns"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
