/**
 * Theme Store -- Zustand store for dark/light/system theme preference.
 *
 * Persists the user's choice to localStorage and applies the `.dark` class
 * on `<html>`. In "system" mode it tracks the OS preference via matchMedia.
 */

import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Cycle through light -> dark -> system. */
  cycle: () => void;
}

const STORAGE_KEY = "theme";
const CYCLE_ORDER: ThemeMode[] = ["light", "dark", "system"];

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const isDark = mode === "dark" || (mode === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getStoredMode();
  applyTheme(initial);

  // Listen for OS preference changes when in system mode
  if (typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (get().mode === "system") applyTheme("system");
    });
  }

  return {
    mode: initial,

    setMode: (mode) => {
      localStorage.setItem(STORAGE_KEY, mode);
      applyTheme(mode);
      set({ mode });
    },

    cycle: () => {
      const current = get().mode;
      const idx = CYCLE_ORDER.indexOf(current);
      const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
      get().setMode(next);
    },
  };
});
