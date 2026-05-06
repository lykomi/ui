/**
 * Sidebar State Management
 *
 * Zustand store for the collapsible left sidebar.
 * Persists expanded/collapsed state to localStorage.
 */

import { create } from "zustand";

export const SIDEBAR_WIDTH = 272;
export const RAIL_WIDTH = 52;
export const SIDEBAR_MIN_WIDTH = 248;
export const SIDEBAR_MAX_WIDTH = 440;
const MOBILE_BREAKPOINT = 768;
const STORAGE_KEY = "sidebar";
const WIDTH_STORAGE_KEY = "sidebar-width";
const WIDTH_VERSION_STORAGE_KEY = "sidebar-width-version";
const WIDTH_PERSIST_DELAY_MS = 120;
const SIDEBAR_WIDTH_VERSION = "2026-03-27-narrow";
let persistWidthTimer: ReturnType<typeof setTimeout> | null = null;

function clampWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

function getStoredOpen(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "true" || stored === "false") return stored === "true";
  // Default: collapsed rail — users expand when they want it
  return false;
}

function getStoredWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_WIDTH;
  const version = localStorage.getItem(WIDTH_VERSION_STORAGE_KEY);
  if (version !== SIDEBAR_WIDTH_VERSION) return SIDEBAR_WIDTH;
  const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
  if (raw === null || raw.trim() === "") return SIDEBAR_WIDTH;
  const stored = Number(raw);
  if (!Number.isFinite(stored)) return SIDEBAR_WIDTH;
  return clampWidth(stored);
}

function persistWidth(width: number): void {
  if (typeof window === "undefined") return;
  if (persistWidthTimer) window.clearTimeout(persistWidthTimer);
  persistWidthTimer = window.setTimeout(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    localStorage.setItem(WIDTH_VERSION_STORAGE_KEY, SIDEBAR_WIDTH_VERSION);
    persistWidthTimer = null;
  }, WIDTH_PERSIST_DELAY_MS);
}

interface SidebarState {
  isOpen: boolean;
  isMobileOpen: boolean;
  width: number;

  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
  setWidth: (width: number) => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isOpen: getStoredOpen(),
  isMobileOpen: false,
  width: getStoredWidth(),

  toggle: () => {
    const next = !get().isOpen;
    localStorage.setItem(STORAGE_KEY, String(next));
    set({ isOpen: next });
  },
  open: () => {
    localStorage.setItem(STORAGE_KEY, "true");
    set({ isOpen: true });
  },
  close: () => {
    localStorage.setItem(STORAGE_KEY, "false");
    set({ isOpen: false });
  },
  toggleMobile: () => set({ isMobileOpen: !get().isMobileOpen }),
  closeMobile: () => set({ isMobileOpen: false }),
  setWidth: (width) => {
    const next = clampWidth(width);
    persistWidth(next);
    set({ width: next });
  },
}));

// Auto-close mobile drawer when resizing above breakpoint
if (typeof window !== "undefined") {
  const version = localStorage.getItem(WIDTH_VERSION_STORAGE_KEY);
  if (version !== SIDEBAR_WIDTH_VERSION) {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(SIDEBAR_WIDTH));
    localStorage.setItem(WIDTH_VERSION_STORAGE_KEY, SIDEBAR_WIDTH_VERSION);
    useSidebarStore.setState({ width: SIDEBAR_WIDTH });
  }

  let timeout: ReturnType<typeof setTimeout>;
  window.addEventListener("resize", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        useSidebarStore.getState().closeMobile();
      }
    }, 100);
  });
}
