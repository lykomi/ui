/**
 * Navigation Configuration — types, default config, and lookup utility.
 *
 * This is the single source of truth for the sidebar and agent context projection.
 * The sidebar and app-layout read from the nav store (nav-store.ts), which is
 * initialized with DEFAULT_NAV_CONFIG. Dynamic items (e.g., from a database)
 * can be merged at runtime via useNavStore.getState().addGroup().
 */

import type { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  // FileEdit,
  // FolderOpen,
  // BarChart3,
  // ClipboardList,
  // FileText,
} from "lucide-react";

export interface NavItemAction {
  icon: LucideIcon;
  label: string;
  handler: () => void | Promise<void>;
  /** Render a separator line before this action. */
  separator?: boolean;
  /** Style as destructive (red text). */
  destructive?: boolean;
}

/** Drag-and-drop behavior for a nav item. Provided by feature modules (e.g., SPACES). */
export interface NavItemDnd {
  /** MIME type for dataTransfer */
  type: string;
  /** Data to set on drag start (e.g., entity ID) */
  getData: () => string | null;
  /** Whether this item can be dragged */
  canDrag: () => boolean;
  /** Whether this item accepts drops */
  canDrop: () => boolean;
  /** Whether this item accepts external file drops (e.g. from Finder) */
  canDropFiles?: () => boolean;
  /** Handle a drop event — receives dragged data string and returns a promise */
  onDrop: (draggedData: string) => Promise<void>;
  /** Handle external file drop — receives File objects from the browser */
  onFileDrop?: (files: File[]) => Promise<void>;
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** When true, the item is visible but not clickable (ghost state for label scope). */
  disabled?: boolean;
  /** Render with reduced opacity (e.g., hidden files). */
  dimmed?: boolean;
  /** Small text badge after the label (e.g., "managed", "locked"). */
  badge?: string;
  /** Page description sent to the agent for context */
  description?: string;
  /** Arbitrary metadata sent to the agent (e.g., workspace IDs, entity types) */
  meta?: Record<string, unknown>;
  /** Page-specific instructions automatically sent to the agent when this page is active */
  contextInstructions?: string;
  /** Sub-navigation items (rendered indented under parent) */
  children?: NavItem[];
  /** Inline action buttons rendered next to the nav item (e.g., + document, + folder) */
  actions?: NavItemAction[];
  /** Optional drag-and-drop behavior (provided by feature modules) */
  dnd?: NavItemDnd;
}

/** Action shown in the "+" dropdown on a nav group header. */
export interface NavGroupCreateAction {
  id: string;
  label: string;
  handler: () => void;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Optional link for the group header label */
  to?: string;
  /** Hide the group header while preserving group semantics. */
  hideLabel?: boolean;
  /** Group description sent to the agent */
  description?: string;
  /** Group-level metadata (e.g., org settings, workspace config, custom instructions) */
  meta?: Record<string, unknown>;
  /** Group-level instructions automatically sent to the agent for all pages in this group */
  contextInstructions?: string;
  /** Create actions shown as a "+" dropdown in the group header */
  createActions?: NavGroupCreateAction[];
}

/** Static default config — the template ships with these pages. */
export const DEFAULT_NAV_CONFIG: NavGroup[] = [
  {
    label: "Pages",
    hideLabel: true,
    items: [
      {
        to: "/",
        label: "Chat",
        icon: MessageSquare,
        description: "Chat with the AI assistant",
      },
      // {
      //   to: "/dashboard",
      //   label: "Dashboard",
      //   icon: BarChart3,
      //   description: "Overview and analytics",
      // },
    ],
  },
  // {
  //   label: "Demos",
  //   description: "Demo pages for the Acme Corp engagement",
  //   meta: {
  //     workspaceId: "ws-acme-2026",
  //     client: "Acme Corp",
  //     region: "eu-west",
  //     permissions: ["read", "write", "comment"],
  //   },
  //   contextInstructions:
  //     "This is the Acme Corp demo workspace. Always address the user professionally. " +
  //     "When referencing documents or drafts, mention they belong to the Acme Corp project.",
  //   items: [
  //     {
  //       to: "/workspace",
  //       label: "Form",
  //       icon: ClipboardList,
  //       description:
  //         "Draft form with fields: title, description, category " +
  //         "(Bug/Feature/Task/Improvement), priority (Low/Medium/High/Critical), " +
  //         "assignee. Use ui_update_content to fill fields.",
  //       meta: { type: "form", formId: "default" },
  //       contextInstructions:
  //         "Always use ui_update_content to fill all fields in a single call. " +
  //         "Ask for confirmation before clearing the form. " +
  //         "Suggest appropriate category and priority based on the description.",
  //     },
  //     {
  //       to: "/documents",
  //       label: "Documents",
  //       icon: FolderOpen,
  //       description: "Browse and manage documents",
  //       children: [
  //         {
  //           to: "/documents",
  //           label: "All Documents",
  //           icon: FolderOpen,
  //           description: "Browse all documents",
  //         },
  //         {
  //           to: "/documents",
  //           label: "Engineering",
  //           icon: FileText,
  //           description: "Engineering documents",
  //           meta: { category: "Engineering" },
  //         },
  //         {
  //           to: "/documents",
  //           label: "Planning",
  //           icon: FileEdit,
  //           description: "Planning documents",
  //           meta: { category: "Planning" },
  //         },
  //       ],
  //     },
  //   ],
  // },
  {
    label: "Workspaces",
    description: "Content management workspaces",
    items: [],
  },
];

/**
 * Find the active nav item by path match.
 * Tries exact match first, then longest-prefix match for dynamic routes.
 * Searches top-level items and their children.
 *
 * For dynamic routes loaded from a database, add them to the nav store
 * at runtime — they'll be found here automatically.
 */
export interface NavMatch {
  group: string;
  groupMeta?: Record<string, unknown>;
  groupDescription?: string;
  groupInstructions?: string;
  item: NavItem;
}

function findExactNavItem(items: NavItem[], path: string): NavItem | null {
  for (const item of items) {
    if (item.to === path) {
      return item;
    }
    if (item.children) {
      const nested = findExactNavItem(item.children, path);
      if (nested) return nested;
    }
  }
  return null;
}

function findBestPrefixNavItem(
  items: NavItem[],
  path: string,
  currentBest: { item: NavItem; length: number } | null = null,
): { item: NavItem; length: number } | null {
  let best = currentBest;
  for (const item of items) {
    if (path.startsWith(item.to + "/") && item.to.length > (best?.length ?? 0)) {
      best = { item, length: item.to.length };
    }
    if (item.children) {
      best = findBestPrefixNavItem(item.children, path, best);
    }
  }
  return best;
}

export function findNavItem(config: NavGroup[], path: string): NavMatch | null {
  // Pass 1: exact match on items
  for (const group of config) {
    const base = {
      group: group.label,
      groupMeta: group.meta,
      groupDescription: group.description,
      groupInstructions: group.contextInstructions,
    };
    const match = findExactNavItem(group.items, path);
    if (match) {
      return { ...base, item: match };
    }
  }

  // Pass 2: group-level `to` match (e.g. /spaces matches Workspaces group)
  for (const group of config) {
    if (group.to && group.to === path) {
      return {
        group: group.label,
        groupMeta: group.meta,
        groupDescription: group.description,
        groupInstructions: group.contextInstructions,
        item: { to: group.to, label: group.label, icon: MessageSquare },
      };
    }
  }

  // Pass 3: longest-prefix match (for dynamic/parameterized routes)
  let best: NavMatch | null = null;
  let bestLen = 0;
  for (const group of config) {
    const base = {
      group: group.label,
      groupMeta: group.meta,
      groupDescription: group.description,
      groupInstructions: group.contextInstructions,
    };
    const match = findBestPrefixNavItem(group.items, path);
    if (match && match.length > bestLen) {
      best = { ...base, item: match.item };
      bestLen = match.length;
    }
  }
  return best;
}
