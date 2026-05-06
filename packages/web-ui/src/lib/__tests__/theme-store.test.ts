// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock matchMedia before importing the store (jsdom doesn't implement it)
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
Object.defineProperty(window, "matchMedia", { value: matchMediaMock, writable: true });

// Import after mock is in place (store initializes on import)
const { useThemeStore } = await import("../theme-store");

const store = () => useThemeStore.getState();

describe("theme-store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    useThemeStore.setState({ mode: "system" });
  });

  describe("setMode", () => {
    it("applies dark class for dark mode", () => {
      store().setMode("dark");
      expect(store().mode).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem("theme")).toBe("dark");
    });

    it("removes dark class for light mode", () => {
      store().setMode("dark");
      store().setMode("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem("theme")).toBe("light");
    });

    it("persists to localStorage", () => {
      store().setMode("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
    });
  });

  describe("cycle", () => {
    it("cycles light -> dark -> system -> light", () => {
      store().setMode("light");
      store().cycle();
      expect(store().mode).toBe("dark");
      store().cycle();
      expect(store().mode).toBe("system");
      store().cycle();
      expect(store().mode).toBe("light");
    });
  });

  describe("system mode", () => {
    it("respects OS dark preference", () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      store().setMode("system");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("respects OS light preference", () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      store().setMode("system");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
