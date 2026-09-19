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
 * "Before the user has aimed" is also the precondition, and only a drag
 * that STARTS here has such a moment: one arriving from the desktop or
 * another window is hit-tested by the browser before any script runs, so
 * the first event this document sees is already aimed. Those get no
 * reservation at all — otherwise the mis-aim simply returns by a different
 * road.
 *
 * jsdom lays out nothing, so this asserts the mechanism: the strip is in
 * flow, it changes only with the drag as a whole, and the band fills it.
 * Plus the three ways "for the whole drag" can quietly become "for most of
 * it" or "for the wrong drag" — an animated opening, an in-page drag that
 * leaves the window, and a source the nav refreshes away mid-drag.
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

async function mount(zone: NavItemDnd = dnd) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ContainerDropZone dnd={zone} />));
  const strip = host.firstElementChild as HTMLElement;
  return { strip, band: strip.firstElementChild as HTMLElement };
}

/** A `dragenter` carrying an arbitrary set of types. */
function dragEnterTypes(element: Element, types: string[]) {
  const event = new Event("dragenter", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types, files: { length: 0 } } });
  element.dispatchEvent(event);
}

/** The drag is dragged out of the browser window: a `dragleave` whose
 *  `relatedTarget` is null, which is the only signal that gives. */
function leaveWindow() {
  const event = new Event("dragleave", { bubbles: true });
  Object.defineProperty(event, "relatedTarget", { value: null });
  window.dispatchEvent(event);
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

it("opens without animating, so the reservation is not itself a moving target", async () => {
  const { strip } = await mount();
  // A 150ms height transition on the way OPEN pushes the destination down
  // for 150ms — which is inside the time a short drag to a nearby row
  // takes, so the target walks away exactly as it did before.
  await act(async () => beginNavDrag(dnd.type));
  expect(strip.className).not.toContain("transition");

  // Closing may animate: nothing is being aimed at by then.
  await act(async () => endNavDrag());
  expect(strip.className).toContain("transition-[height,margin]");
});

it("reserves its space when the drag starts, not when the pointer arrives", async () => {
  const { strip, band } = await mount();
  const atRest = strip.className;
  expect(atRest).toContain("h-1");

  // The drag beginning is what makes room — before the user has aimed.
  await act(async () => beginNavDrag(dnd.type));
  expect(strip.className).toContain("h-7");
  expect(strip.className).not.toContain("h-1");
  expect(host!.textContent).toContain("Move to root");

  // And it holds for the whole drag, however the pointer moves over it:
  // the layout settles once, when the drag starts, and never again while
  // the user is aiming.
  const reserved = strip.className;
  await act(async () => dragEnterTypes(band, [dnd.type]));
  expect(strip.className).toBe(reserved);
  await act(async () => dragEnterTypes(document.documentElement, [dnd.type]));
  expect(strip.className).toBe(reserved);

  await act(async () => endNavDrag());
  expect(strip.className).toBe(atRest);
});

it("keeps a nested row's type when the drag bubbles to its container", async () => {
  // `dragstart` bubbles, and a draggable row sits inside a draggable
  // container, so both handlers run. Publishing one type meant the
  // ancestor's (it runs last) and zones matching the child's payload
  // stayed shut, though the payload was right there in `dataTransfer`.
  const { strip } = await mount();
  await act(async () => {
    beginNavDrag(dnd.type); // the nested row
    beginNavDrag("application/x-container"); // its draggable ancestor
  });
  expect(strip.className).toContain("h-7");
});

it("holds the reservation when an in-page drag leaves the window and returns", async () => {
  const { strip } = await mount();
  await act(async () => beginNavDrag(dnd.type));
  expect(strip.className).toContain("h-7");

  // A drag dragged out of the window fires a `dragleave` with no
  // `relatedTarget` and nothing else. That is the same signal whether the
  // drag is over or merely outside, and this one is not over: it will come
  // back, and its `dragend` will close it. Ending on it collapsed every
  // zone for the rest of the gesture, so the root the user was aiming at
  // vanished as they reached for it.
  await act(async () => leaveWindow());
  expect(strip.className).toContain("h-7");

  // And it still ends properly when the drag actually ends.
  await act(async () => window.dispatchEvent(new Event("dragend")));
  expect(strip.className).toContain("h-1");
});

it("stays shut for another module's entity drag", async () => {
  // Two modules, two `dnd.type`s. "Some drag is in flight" opened both
  // sides' zones; only the one that can read this payload may open.
  const { strip } = await mount();

  await act(async () => beginNavDrag("application/x-other-module"));
  expect(strip.className).toContain("h-1");

  // And its own type still opens it, so the gate is not simply shut.
  await act(async () => beginNavDrag(dnd.type));
  expect(strip.className).toContain("h-7");
});

it("keeps a MIME type whole when it contains a separator", async () => {
  // `|` is not one of RFC 2045's tspecials, so it is legal in a MIME token.
  // While the type set was published as a joined string, such a type split
  // into two: the zone that owns it stayed shut, and a zone matching a
  // fragment would open for data it cannot read.
  const piped: NavItemDnd = { ...dnd, type: "application/x-entity|v2" };
  const { strip } = await mount(piped);

  // A different type that happens to be one of its fragments must not open it.
  await act(async () => beginNavDrag("application/x-entity"));
  expect(strip.className).toContain("h-1");

  await act(async () => endNavDrag());
  await act(async () => beginNavDrag(piped.type));
  expect(strip.className).toContain("h-7");
});

it("ends the drag when a nav refresh detaches the row it started from", async () => {
  const { strip } = await mount();
  // A source removed mid-drag still receives its own `dragend`, but a
  // detached node's event reaches no window listener, and nothing else ends
  // the drag. So the reservation stayed open, every zone expanded, until
  // the next drag that happened to finish somewhere else.
  const source = document.createElement("div");
  document.body.append(source);
  await act(async () => beginNavDrag(dnd.type, source));
  expect(strip.className).toContain("h-7");

  source.remove();
  await act(async () => source.dispatchEvent(new Event("dragend", { bubbles: true })));
  expect(strip.className).toContain("h-1");
});

it("stays shut for a drag that arrives already aimed", async () => {
  const { strip } = await mount();
  // A drag from the desktop, or from another window, is hit-tested by the
  // browser before any script runs — so the first `dragenter` this document
  // sees is already pointing at a row. Opening the zones from it would move
  // that row out from under a stationary pointer, which is the failure this
  // whole mechanism exists to remove. There is no earlier moment to use, so
  // there is no reservation — and a `dragenter` therefore opens nothing,
  // whatever it carries.
  await act(async () => dragEnterTypes(document.documentElement, ["Files"]));
  expect(strip.className).toContain("h-1");
  expect(host!.textContent).toBe("");

  // Not even something the nav has no use for at all.
  await act(async () => dragEnterTypes(document.documentElement, ["text/plain"]));
  expect(strip.className).toContain("h-1");

  // Same for an entity dragged in from another window of the app: no
  // `dragstart` here either, so the same reasoning applies.
  await act(async () => dragEnterTypes(document.documentElement, [dnd.type]));
  expect(strip.className).toContain("h-1");
});

it("stays shut when the aimed-at row is the one that would be pushed", async () => {
  const { strip, band } = await mount();
  // The case stated most sharply: the file enters DIRECTLY over a row, so
  // the only event available is the one the browser has already resolved
  // against that row. Nothing may move on it.
  await act(async () => dragEnterTypes(band, ["Files"]));
  expect(strip.className).toContain("h-1");
  await act(async () => dragEnterTypes(strip, ["Files"]));
  expect(strip.className).toContain("h-1");
});
