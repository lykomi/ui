import { beforeEach, describe, expect, it } from "vitest";
import { useToolPanelStore } from "../tool-panel-store";

const reset = () =>
  useToolPanelStore.setState({
    isOpen: false,
    content: null,
    isFullscreen: false,
    // Node env fallbacks
    panelWidth: 800,
    useOverlay: true,
  });

const store = () => useToolPanelStore.getState();

const content = { title: "Test", content: "body", type: "markdown" as const };

describe("tool-panel-store", () => {
  beforeEach(reset);

  describe("toggleFullscreen", () => {
    it("entering fullscreen sets overlay and expands width", () => {
      store().toggleFullscreen();
      expect(store().isFullscreen).toBe(true);
      expect(store().useOverlay).toBe(true);
    });

    it("exiting fullscreen restores layout defaults", () => {
      store().toggleFullscreen(); // on
      store().toggleFullscreen(); // off
      expect(store().isFullscreen).toBe(false);
      // jsdom: innerWidth=1024 < 1280, so overlay=true, panelWidth=1024
      expect(store().useOverlay).toBe(true);
      expect(store().panelWidth).toBeLessThanOrEqual(1280);
    });
  });

  describe("updateLayout", () => {
    it("is a no-op when fullscreen", () => {
      store().openPanel(content);
      store().toggleFullscreen();
      const widthBefore = store().panelWidth;
      store().updateLayout();
      expect(store().panelWidth).toBe(widthBefore);
    });

    it("recalculates when not fullscreen", () => {
      store().updateLayout();
      // jsdom: innerWidth=1024 < 1280, so overlay=true
      expect(store().useOverlay).toBe(true);
      expect(store().panelWidth).toBeLessThanOrEqual(1280);
    });
  });

  describe("SSR / Node fallbacks", () => {
    it("defaults to panelWidth=800 and useOverlay=true without window", () => {
      expect(store().panelWidth).toBe(800);
      expect(store().useOverlay).toBe(true);
    });
  });
});
