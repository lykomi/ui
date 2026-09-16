// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

it("can preview a mode without replacing the saved preference", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn() }));
  localStorage.setItem("theme", "system");
  const { useThemeStore } = await import("../lib/theme-store");
  useThemeStore.getState().setMode("dark", { persist: false });
  expect(useThemeStore.getState().mode).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("theme")).toBe("system");
  useThemeStore.getState().setMode("system", { persist: false });
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  useThemeStore.getState().setMode("light");
  expect(localStorage.getItem("theme")).toBe("light");
  localStorage.clear();
  vi.unstubAllGlobals();
});
