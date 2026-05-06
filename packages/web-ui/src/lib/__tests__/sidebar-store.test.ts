import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
  useSidebarStore,
} from "../sidebar-store";

const SIDEBAR_WIDTH_VERSION = "2026-03-27-narrow";

const reset = () =>
  useSidebarStore.setState({
    isOpen: true,
    isMobileOpen: false,
    width: SIDEBAR_WIDTH,
  });

const store = () => useSidebarStore.getState();

async function importFreshSidebarStore(
  storageValue: string | null,
  storageVersion: string | null = SIDEBAR_WIDTH_VERSION,
) {
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockImplementation((key: string) => {
      if (key === "sidebar-width") return storageValue;
      if (key === "sidebar-width-version") return storageVersion;
      return null;
    }),
    setItem: vi.fn(),
  });
  return import("../sidebar-store");
}

describe("sidebar-store", () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
  });

  describe("toggle", () => {
    it("flips isOpen from true to false", () => {
      store().toggle();
      expect(store().isOpen).toBe(false);
    });

    it("flips isOpen from false to true", () => {
      useSidebarStore.setState({ isOpen: false });
      store().toggle();
      expect(store().isOpen).toBe(true);
    });

    it("persists state to localStorage", () => {
      store().toggle();
      expect(localStorage.setItem).toHaveBeenCalledWith("sidebar", "false");
    });
  });

  describe("open / close", () => {
    it("open sets isOpen to true", () => {
      useSidebarStore.setState({ isOpen: false });
      store().open();
      expect(store().isOpen).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith("sidebar", "true");
    });

    it("close sets isOpen to false", () => {
      store().close();
      expect(store().isOpen).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith("sidebar", "false");
    });
  });

  describe("mobile drawer", () => {
    it("toggleMobile flips isMobileOpen", () => {
      store().toggleMobile();
      expect(store().isMobileOpen).toBe(true);
      store().toggleMobile();
      expect(store().isMobileOpen).toBe(false);
    });

    it("closeMobile sets isMobileOpen to false", () => {
      useSidebarStore.setState({ isMobileOpen: true });
      store().closeMobile();
      expect(store().isMobileOpen).toBe(false);
    });
  });

  describe("setWidth", () => {
    it("persists sidebar width to localStorage", () => {
      store().setWidth(360);
      vi.runAllTimers();
      expect(store().width).toBe(360);
      expect(localStorage.setItem).toHaveBeenCalledWith("sidebar-width", "360");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "sidebar-width-version",
        SIDEBAR_WIDTH_VERSION,
      );
    });

    it("clamps width to the supported range", () => {
      store().setWidth(999);
      expect(store().width).toBe(SIDEBAR_MAX_WIDTH);

      store().setWidth(100);
      expect(store().width).toBe(SIDEBAR_MIN_WIDTH);
    });
  });

  describe("initial width from localStorage", () => {
    it("falls back to default width when sidebar-width is missing", async () => {
      const { useSidebarStore: freshStore } = await importFreshSidebarStore(null);
      expect(freshStore.getState().width).toBe(SIDEBAR_WIDTH);
    });

    it("falls back to default width when sidebar-width is invalid", async () => {
      const { useSidebarStore: freshStore } = await importFreshSidebarStore("not-a-number");
      expect(freshStore.getState().width).toBe(SIDEBAR_WIDTH);
    });

    it("uses stored width when within the supported range", async () => {
      const { useSidebarStore: freshStore } = await importFreshSidebarStore("360");
      expect(freshStore.getState().width).toBe(360);
    });

    it("clamps stored width to the supported range", async () => {
      const { useSidebarStore: largeStore } = await importFreshSidebarStore("999");
      expect(largeStore.getState().width).toBe(SIDEBAR_MAX_WIDTH);

      const { useSidebarStore: smallStore } = await importFreshSidebarStore("100");
      expect(smallStore.getState().width).toBe(SIDEBAR_MIN_WIDTH);
    });

    it("resets legacy stored widths when the version changes", async () => {
      const { useSidebarStore: freshStore } = await importFreshSidebarStore("394", null);
      expect(freshStore.getState().width).toBe(SIDEBAR_WIDTH);
    });
  });
});
