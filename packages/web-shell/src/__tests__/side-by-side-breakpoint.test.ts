import { describe, it, expect } from "vitest";
import layoutSource from "../shell-layout.tsx?raw";
import { SIDE_BY_SIDE_MIN_VIEWPORT, SIDE_BY_SIDE_BREAKPOINT_PX } from "../use-page-panel-width.ts";

/**
 * The layout gates the side-by-side split with a Tailwind arbitrary variant,
 * which has to be a static string — it cannot interpolate the constant. So the
 * number lives in two places, and this test is what stops them drifting.
 *
 * The drift it guards against already happened: the gate was `xl` (1280px)
 * while the columns actually fit from 780px, so expanding the chat beside an
 * open document hid the document on every window in between. Raising either
 * minimum without moving the class would silently reintroduce a band where the
 * page is hidden though the split would have worked.
 *
 * Reading the layout's own source is the point — comparing the two constants to
 * each other would pass happily while the class said something else entirely.
 */
describe("side-by-side breakpoint", () => {
  it("matches MIN_PAGE_PANEL_WIDTH + MIN_CHAT_WIDTH", () => {
    expect(SIDE_BY_SIDE_BREAKPOINT_PX).toBe(SIDE_BY_SIDE_MIN_VIEWPORT);
  });

  it("is the breakpoint the layout actually gates on", () => {
    const used = [...layoutSource.matchAll(/min-\[(\d+)px\]:/g)].map((m) => Number(m[1]));
    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used)]).toEqual([SIDE_BY_SIDE_BREAKPOINT_PX]);
  });

  it("does not gate the page column on a named breakpoint again", () => {
    // `xl:` was the original bug. Any named breakpoint on the page column is
    // a number that cannot track the minimums, whatever its value.
    const pageColumn = layoutSource.slice(
      layoutSource.indexOf("showPagePanel"),
      layoutSource.indexOf("showPagePanel") + 800,
    );
    expect(pageColumn).not.toMatch(/\b(sm|md|lg|xl|2xl):/);
  });
});
