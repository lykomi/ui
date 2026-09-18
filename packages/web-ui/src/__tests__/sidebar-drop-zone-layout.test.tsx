/**
 * The container drop zone must not move the rows beneath it.
 *
 * It is a 4px strip that becomes a 28px labelled band while a drag is over
 * it. When that growth happened in flow, every row below the strip jumped
 * down by 24px at the exact moment the pointer crossed it — which is the
 * moment the user is aiming at one of those rows. Dragging an item from an
 * open folder to a folder below it crosses one strip per open container, so
 * the destination walked away from the cursor (28px per crossing, measured
 * in Chromium) and the drop landed on whatever had slid underneath. From
 * the user's seat: the drag did nothing, no request was made, and there was
 * nothing to read anywhere.
 *
 * jsdom lays out nothing, so this asserts the mechanism instead: the node
 * that changes size is absolutely positioned, and the node that holds the
 * space is untouched by the drag.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
import { ContainerDropZone } from "../components/sidebar.tsx";
import type { NavItemDnd } from "../lib/nav-config.ts";

const dnd: NavItemDnd = {
  type: "application/x-test-entity",
  getData: () => "dragged",
  canDrag: () => true,
  canDrop: () => true,
  onDrop: async () => {},
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  host?.remove();
  host = null;
});

/** A ``dragenter`` carrying the zone's own MIME type — what the browser
 *  sends as the pointer crosses the strip. */
function dragEnter(element: Element) {
  const event = new Event("dragenter", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: [dnd.type], files: { length: 0 } },
  });
  element.dispatchEvent(event);
}

it("grows out of flow, so the rows beneath it do not move mid-drag", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ContainerDropZone dnd={dnd} />));

  const strip = host.firstElementChild as HTMLElement;
  const band = strip.firstElementChild as HTMLElement;
  const stripClassesAtRest = strip.className;

  // The strip holds the space and the band paints inside it.
  expect(strip.className).toContain("relative");
  expect(band.className).toContain("absolute");

  await act(async () => dragEnter(band));

  // Hovering changed the band and nothing else. If the strip's classes
  // move, so does every row under it.
  expect(strip.className).toBe(stripClassesAtRest);
  expect(band.className).toContain("h-7");
  expect(band.className).toContain("absolute");
  expect(host.textContent).toContain("Move to root");
});

it("keeps the expanded band above the rows it overlaps", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ContainerDropZone dnd={dnd} />));

  const band = (host.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
  await act(async () => dragEnter(band));

  // Out of flow, the band overlaps its neighbours — and rows AFTER it in
  // DOM order would otherwise win both the paint and the hit test in that
  // overlap, which is the same missed drop by another route.
  expect(band.className).toContain("z-10");
});
