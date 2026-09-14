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
  /** Small status dot after the label for quiet state hints such as pending review impact. */
  statusDot?: {
    tone?: "neutral" | "info" | "low-impact" | "medium-impact" | "high-impact" | "pending";
    label?: string;
  };
  /**
   * Optional warning / status icon shown after the label. Use for
   * "something needs attention" annotations (e.g. failed indexing,
   * permission drift) where a coloured dot isn't legible enough.
   * Pass any LucideIcon; the tone drives the colour.
   */
  statusIcon?: {
    icon: LucideIcon;
    tone?: "neutral" | "info" | "warning" | "danger";
    label?: string;
  };
  /** Page description sent to the agent for context */
  description?: string;
  /** Arbitrary metadata sent to the agent (e.g., workspace IDs, entity types) */
  meta?: Record<string, unknown>;
  /** Page-specific instructions automatically sent to the agent when this page is active */
  contextInstructions?: string;
  /** Sub-navigation items (rendered indented under parent) */
  children?: NavItem[];
  /** Keep descendant routes in the context model, but represent them by this
   * row in the sidebar (for example, records opened from a list). */
  childrenHidden?: boolean;
  /**
   * The row's children have not been fetched yet, so `children` being empty
   * says nothing about whether it has any.
   *
   * A tree row normally shows one of two markers: a chevron if it branches, a
   * dot if it is a leaf. That is two states for a question with THREE answers
   * — has children, has none, and nobody has looked. A caller that loads
   * subtrees lazily (only the active one, say) leaves every other row with an
   * empty `children`, and the row then claims to be a leaf on the strength of
   * a fetch that never happened.
   *
   * Set this while the answer is unknown and the row shows neither marker: no
   * chevron to click into nothing, no dot asserting an emptiness no one
   * checked. Clear it once the children are known, empty or not.
   */
  childrenUnloaded?: boolean;
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

/** Item rendered on the collapsed sidebar rail. Returned by `NavGroup.collapsedRail`. */
export interface CollapsedRailItem {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}

/**
 * Context passed to `NavGroup.collapsedRail` so the renderer can decide which
 * shortcuts to surface. Modules read their own keys out of `navContextMeta`
 * (e.g., Spaces uses `spacesRootId`).
 */
export interface CollapsedRailContext {
  currentPage: string;
  navContextMeta: Record<string, unknown>;
}

export interface NavGroup {
  label: string;
  /** Keep tree indicators for known leaves even when no current item branches. */
  tree?: boolean;
  /** Icon for a group entry point in a compact navigation rail. */
  icon?: LucideIcon;
  items: NavItem[];
  /**
   * Render order weight. Higher = higher in the sidebar. Default 0.
   * Ties keep insertion order (stable sort), so existing call sites
   * that don't set a priority preserve the legacy "addGroup appends"
   * behaviour. Use this to pin a group to a specific slot regardless
   * of which feature hook finishes first.
   */
  priority?: number;
  /**
   * When true, the group header gets a click-to-toggle chevron and
   * the children hide when collapsed. State persists per group label
   * in localStorage so the user's preference survives reloads. Mutually
   * exclusive with ``hideLabel`` — a hidden label can't host a chevron.
   *
   * If any child carries a :attr:`NavItem.statusDot`, it bubbles up to
   * the collapsed header so the user can still see "the active chat is
   * inside this collapsed group" without auto-expanding.
   */
  collapsible?: boolean;
  /** Initial collapse state when no user preference is stored. */
  defaultCollapsed?: boolean;
  /** Optional link for the group header label */
  to?: string;
  /** Hide the group header while preserving group semantics. */
  hideLabel?: boolean;
  /**
   * The ``to`` of the item this group is focused on, if any.
   *
   * A focused group draws that item alone: the header keeps its label,
   * typography and height and leads back to ``to`` (a back chevron in the
   * collapse chevron's column, the label as the link); the item is drawn
   * as a flat, emphasised heading with its children beneath it — one
   * indent step left of a branch's children, at their usual row size —
   * and its siblings are not drawn. Nothing above the item moves and no
   * row resizes when the group focuses or unfocuses.
   *
   * Focus takes precedence over ``collapsible``. It needs a visible label
   * and a ``to`` to lead back to; without either, or when no item carries
   * that ``to``, the group draws as usual. Only the group's own items can
   * be focused, not their descendants. The value is the caller's: the
   * back link navigates to ``to`` and nothing more, so the caller derives
   * ``focusOn`` from the route (or its own state) and clears it there.
   */
  focusOn?: string;
  /** Group description sent to the agent */
  description?: string;
  /** Group-level metadata (e.g., org settings, workspace config, custom instructions) */
  meta?: Record<string, unknown>;
  /** Group-level instructions automatically sent to the agent for all pages in this group */
  contextInstructions?: string;
  /** Create actions shown as a "+" dropdown in the group header */
  createActions?: NavGroupCreateAction[];
  /**
   * Optional override for the collapsed sidebar rail. When present, the
   * shell calls this instead of mapping `items` to icons one-to-one.
   *
   * Useful for groups whose collapsed view is "header link plus the active
   * item's root", not a flat icon list. Returning `[]` hides the group.
   */
  collapsedRail?: (ctx: CollapsedRailContext) => CollapsedRailItem[];
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
