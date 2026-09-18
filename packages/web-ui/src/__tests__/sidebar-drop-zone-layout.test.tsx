/**
 * The container drop zone must not move the rows beneath it, and must not
 * answer for the rows beside it.
 *
 * It is a 4px strip that becomes a 28px labelled band. WHEN it grows decides
 * whether the sidebar is usable, and both of the obvious answers are wrong:
 *
 *  - growing IN FLOW on hover pushes every row below it down 24px at the
 *    moment the pointer crosses it — which is the moment the user is aiming
 *    at one of those rows, so the destination walks away from the cursor and
 *    the drop lands on whatever slid underneath. Measured in Chromium: 28px
 *    per crossing. From the user's seat the drag did nothing.
 *  - growing OUT OF FLOW fixes that and breaks something else: the expanded
 *    band covers ~12px of the rows on either side and, being positioned,
 *    takes their drops. A moving target traded for a wrong one.
 *
 * So the space is reserved for the whole drag. The layout settles once,
 * before the user has aimed at anything, and the band that is painted is
 * exactly the area that accepts.
 *
 * jsdom lays out nothing, so this asserts the mechanism: the strip is in
 * flow, it changes only with the drag as a whole, and the band fills it.
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
import { beginNavDrag, endNavDrag, __resetNavDragForTest } from "../lib/nav-dnd.ts";
import type { NavItemDnd } from "../lib/nav-config.ts";

const dnd: NavItemDnd = {
  type: "application/x-test-entity",
  getData: () => "dragged",
  canDrag: () => true,
  canDrop: () => true,
  canDropFiles: () => true,
  onDrop: async () => {},
  onFileDrop: async () => {},
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  host?.remove();
  host = null;
  __resetNavDragForTest();
});

async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ContainerDropZone dnd={dnd} />));
  const strip = host.firstElementChild as HTMLElement;
  return { strip, band: strip.firstElementChild as HTMLElement };
}

/** A `dragenter` carrying the zone's own MIME type. */
function dragEnter(element: Element, files = false) {
  const event = new Event("dragenter", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { types: files ? ["Files"] : [dnd.type], files: { length: files ? 1 : 0 } },
  });
  element.dispatchEvent(event);
}

it("stays in flow, so the band never covers a neighbouring row", async () => {
  const { strip, band } = await mount();
  // Out of flow it would overlap the rows on either side and, being
  // positioned, take their drops.
  expect(strip.className).not.toContain("absolute");
  expect(band.className).not.toContain("absolute");
  // The band is the reserved strip, so painted area == droppable area.
  expect(band.className).toContain("h-full");
});

it("reserves its space when the drag starts, not when the pointer arrives", async () => {
  const { strip, band } = await mount();
  const atRest = strip.className;
  expect(atRest).toContain("h-1");

  // Hovering must not resize anything: that is the moving target.
  await act(async () => dragEnter(band));
  expect(strip.className).toBe(atRest);

  // The drag beginning is what makes room — before the user has aimed.
  await act(async () => beginNavDrag());
  expect(strip.className).toContain("h-7");
  expect(strip.className).not.toContain("h-1");
  expect(host!.textContent).toContain("Move to root");

  // And it holds for the whole drag, however the pointer moves over it.
  const reserved = strip.className;
  await act(async () => dragEnter(band));
  expect(strip.className).toBe(reserved);

  await act(async () => endNavDrag());
  expect(strip.className).toBe(atRest);
});

it("opens for a drag from the desktop, which has no dragstart here", async () => {
  const { strip, band } = await mount();
  expect(strip.className).toContain("h-1");

  // The source is outside the document, so the first sight of `Files` on a
  // dragenter is the only announcement the page gets.
  await act(async () => dragEnter(band, true));
  expect(strip.className).toContain("h-7");
  expect(host!.textContent).toContain("Upload to root");
});
