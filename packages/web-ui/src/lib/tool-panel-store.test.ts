// @vitest-environment jsdom
/**
 * Panel resize — the chat/content split must be user-controllable and
 * persistent, and neither side may be squeezed out of usefulness.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { clampPanelWidth, useToolPanelStore } from "./tool-panel-store";

describe("clampPanelWidth", () => {
  it("keeps a usable minimum for the panel", () => {
    expect(clampPanelWidth(50, 1600)).toBe(360);
  });

  it("keeps a usable minimum for the content beside it", () => {
    // 1600 viewport - 420 sibling floor = 1180 max panel
    expect(clampPanelWidth(1590, 1600)).toBe(1180);
  });

  it("passes a sensible width through unchanged", () => {
    expect(clampPanelWidth(700, 1600)).toBe(700);
  });

  it("goes full-width below the side-by-side breakpoint", () => {
    expect(clampPanelWidth(500, 900)).toBe(900);
  });
});

describe("setPanelWidth", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useToolPanelStore.setState({ isFullscreen: false });
  });

  it("applies the clamped width and persists it", () => {
    useToolPanelStore.getState().setPanelWidth(720);
    expect(useToolPanelStore.getState().panelWidth).toBe(clampPanelWidth(720, window.innerWidth));
    expect(window.localStorage.getItem("foundry.toolPanel.width")).toBe(
      String(clampPanelWidth(720, window.innerWidth)),
    );
  });

  it("is inert in fullscreen (the panel owns the whole viewport)", () => {
    useToolPanelStore.setState({ isFullscreen: true, panelWidth: 1000 });
    useToolPanelStore.getState().setPanelWidth(500);
    expect(useToolPanelStore.getState().panelWidth).toBe(1000);
  });
});

it("gives distinct results stable identities across updates and restoration", () => {
  const store = useToolPanelStore.getState;
  const result = { type: "text" as const, title: "Result", content: "First" };
  store().openPanel(result);
  const first = store().content!.sourceId;
  store().setContent({ ...result, content: "Updated" });
  expect(store().content!.sourceId).toBe(first);
  store().openPanel(result);
  expect(store().content!.sourceId).not.toBe(first);
  store().openPanel({ ...result, sourceId: first });
  expect(store().content!.sourceId).toBe(first);
});
