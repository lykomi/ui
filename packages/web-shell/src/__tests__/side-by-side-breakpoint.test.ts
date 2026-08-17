import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { SIDE_BY_SIDE_MIN_VIEWPORT } from "../use-page-panel-width.ts";

/**
 * The layout gates the side-by-side split with a Tailwind arbitrary variant,
 * which has to be a static string — it cannot interpolate the constant. So the
 * number lives in two places, and this test is what stops them drifting.
 *
 * The drift it guards against already happened once in the other direction:
 * the gate was `xl` (1280px) while the columns actually fit from 780px, so
 * expanding the chat beside an open document hid the document on every window
 * in between. Raising a minimum without moving the class would silently
 * reintroduce a band where the page is hidden but the split would have worked.
 */
describe("side-by-side breakpoint", () => {
  // Resolved from the package root: vitest serves `import.meta.url` over a
  // non-file scheme here, so `new URL(...)` cannot be handed to readFileSync.
  const layout = readFileSync(resolve(process.cwd(), "src/shell-layout.tsx"), "utf8");

  it("matches MIN_PAGE_PANEL_WIDTH + MIN_CHAT_WIDTH", () => {
    const used = [...layout.matchAll(/min-\[(\d+)px\]/g)].map((m) => Number(m[1]));

    expect(used.length).toBeGreaterThan(0);
    for (const px of used) {
      expect(px).toBe(SIDE_BY_SIDE_MIN_VIEWPORT);
    }
  });

  it("no longer gates the page column on an unrelated breakpoint", () => {
    // `xl:` on the page column is the specific mistake being prevented.
    expect(layout).not.toMatch(/xl:(flex|block|hidden)/);
  });
});
