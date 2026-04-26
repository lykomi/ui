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

interface NavStoreState {
  config: NavGroup[];
  footerActions: NavFooterAction[];
  /** Replace the entire config */
  setConfig: (config: NavGroup[]) => void;
  /** Add a group (replaces existing group with the same label) */
  addGroup: (group: NavGroup) => void;
  /** Remove a group by label */
  removeGroup: (label: string) => void;
  /** Register a footer toggle (replaces existing by id) */
  setFooterAction: (action: NavFooterAction) => void;
  /** Remove a footer action by id */
  removeFooterAction: (id: string) => void;
}

export const useNavStore = create<NavStoreState>((set, get) => ({
  config: DEFAULT_NAV_CONFIG,
  footerActions: [],

  setConfig: (config) => set({ config }),

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
}));
