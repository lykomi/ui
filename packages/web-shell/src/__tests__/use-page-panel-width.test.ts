// @vitest-environment jsdom
/**
 * The chat/content split in expanded mode was a hardcoded 600px. It must be
 * user-draggable, clamped so neither side collapses, and persisted.
 */
import { describe, expect, it } from "vitest";

import { clampPagePanelWidth, MIN_PAGE_PANEL_WIDTH } from "../use-page-panel-width.ts";

describe("clampPagePanelWidth", () => {
  it("keeps a usable minimum for the content panel", () => {
    expect(clampPagePanelWidth(50, 1600)).toBe(MIN_PAGE_PANEL_WIDTH);
  });

  it("keeps a usable minimum for the chat column", () => {
    // 1600 viewport - 420 chat floor = 1180 max panel
    expect(clampPagePanelWidth(1590, 1600)).toBe(1180);
  });

  it("passes a sensible width through unchanged", () => {
    expect(clampPagePanelWidth(700, 1600)).toBe(700);
  });

  it("never returns a panel wider than the viewport allows on small screens", () => {
    const v = 700;
    const w = clampPagePanelWidth(650, v);
    expect(w).toBeLessThanOrEqual(v);
    expect(w).toBeGreaterThanOrEqual(MIN_PAGE_PANEL_WIDTH);
  });
});
