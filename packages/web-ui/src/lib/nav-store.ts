/**
 * Navigation Store — Zustand store for the live navigation config.
 *
 * Initialized with DEFAULT_NAV_CONFIG (static pages).
 * Dynamic groups/items (e.g., contract workspaces from a database)
 * can be merged at runtime via addGroup() or setConfig().
 *
 * The sidebar and app-layout both subscribe to this store,
 * so changes propagate automatically.
 */

import { create } from "zustand";
import { type NavGroup, DEFAULT_NAV_CONFIG } from "./nav-config.ts";

/** A toggle or action rendered at the bottom of the sidebar. */
export interface NavFooterAction {
  id: string;
  label: string;
  activeLabel?: string;
  active: boolean;
  onToggle: () => void;
}

/**
 * A setting the user turns on or off from the user menu — present in every
 * shell, where the sidebar footer is not (the workbench hides it inside a
 * workspace). For a preference about the whole interface: "show hidden items".
 */
export interface UserMenuToggle {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

interface NavStoreState {
  config: NavGroup[];
  footerActions: NavFooterAction[];
  userMenuToggles: UserMenuToggle[];
  /**
   * True while an integrator's nav sync is loading its first batch of
   * groups. Optional/defaulted (starts ``false``) so existing consumers
   * that never set it are unaffected. The sidebar reads it to render
   * skeleton rows instead of an empty list during the cold fetch —
   * avoids the "empty sidebar for N seconds" gap on a slow nav sync.
   */
  navLoading: boolean;
  /** Replace the entire config */
  setConfig: (config: NavGroup[]) => void;
  /** Toggle the cold-load skeleton state. */
  setNavLoading: (loading: boolean) => void;
  /** Add a group (replaces existing group with the same label) */
  addGroup: (group: NavGroup) => void;
  /** Remove a group by label */
  removeGroup: (label: string) => void;
  /** Register a footer toggle (replaces existing by id) */
  setFooterAction: (action: NavFooterAction) => void;
  /** Remove a footer action by id */
  removeFooterAction: (id: string) => void;
  /** Register a user-menu toggle (replaces existing by id) */
  setUserMenuToggle: (toggle: UserMenuToggle) => void;
  /** Remove a user-menu toggle by id */
  removeUserMenuToggle: (id: string) => void;
}

export const useNavStore = create<NavStoreState>((set, get) => ({
  config: DEFAULT_NAV_CONFIG,
  footerActions: [],
  userMenuToggles: [],
  navLoading: false,

  setConfig: (config) => set({ config }),

  setNavLoading: (navLoading) => set({ navLoading }),

  addGroup: (group) => {
    const config = get().config;
    const idx = config.findIndex((g) => g.label === group.label);
    if (idx >= 0) {
      const next = [...config];
      next[idx] = group;
      set({ config: next });
    } else {
      set({ config: [...config, group] });
    }
  },

  removeGroup: (label) => {
    set({ config: get().config.filter((g) => g.label !== label) });
  },

  setFooterAction: (action) => {
    const actions = get().footerActions;
    const idx = actions.findIndex((a) => a.id === action.id);
    if (idx >= 0) {
      const next = [...actions];
      next[idx] = action;
      set({ footerActions: next });
    } else {
      set({ footerActions: [...actions, action] });
    }
  },

  removeFooterAction: (id) => {
    set({ footerActions: get().footerActions.filter((a) => a.id !== id) });
  },

  setUserMenuToggle: (toggle) => {
    const toggles = get().userMenuToggles;
    const idx = toggles.findIndex((t) => t.id === toggle.id);
    set({
      userMenuToggles:
        idx >= 0 ? toggles.map((t, i) => (i === idx ? toggle : t)) : [...toggles, toggle],
    });
  },

  removeUserMenuToggle: (id) => {
    set({ userMenuToggles: get().userMenuToggles.filter((t) => t.id !== id) });
  },
}));
