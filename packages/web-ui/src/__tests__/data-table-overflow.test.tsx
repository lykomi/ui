import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DataTableOverflow } from "../components/data-table/data-table-overflow.tsx";

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

it("maps a shorter bottom scrollbar to the full table range without resetting vertical position", async () => {
  const element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 400 }, scrollWidth: { value: 1000 } });
  element.scrollTop = 180;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<DataTableOverflow scroller={{ current: element }} />));
    const track = host.querySelector<HTMLElement>('[aria-label="Horizontal column scrollbar"]')!;
    Object.defineProperty(track, "clientWidth", { value: 280 });
    await act(async () => element.dispatchEvent(new Event("scroll")));
    expect((track.firstElementChild as HTMLElement).style.width).toBe("880px");
    await act(async () => {
      track.scrollLeft = 600;
      track.dispatchEvent(new Event("scroll"));
      element.dispatchEvent(new Event("scroll"));
    });
    expect(element.scrollLeft).toBe(600);
    expect(element.scrollTop).toBe(180);
    expect((host.querySelector('[aria-label="Next columns"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
