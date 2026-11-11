import { ArrowRight, Layers } from "lucide-react";
import type { NavGroup, NavItem } from "../lib/nav-config.ts";

const LIMIT = 5;
const isPersonal = (item: NavItem) =>
  ["personal_space", "personal-space"].includes(String(item.meta?.spacesContentType));
const spaceId = (item: NavItem) =>
  String(item.meta?.spacesRootId ?? item.meta?.spacesEntityId ?? item.to);

/** The owning module supplies persisted user state; the shell only draws authorized shortcuts. */
export function useRecentSpaceIds(groups: NavGroup[]): string[] {
  const state = groups.find((group) => group.meta?.type === "spaces-workspaces")?.meta
    ?.userState as { recentSpaceIds?: string[] } | undefined;
  return state?.recentSpaceIds ?? EMPTY_IDS;
}
const EMPTY_IDS: string[] = [];

export function overviewSpaceGroups(group: NavGroup, recentIds: string[]): NavGroup[] {
  const authorized = new Map(
    group.items
      .filter((item) => !isPersonal(item) && !item.disabled)
      .map((item) => [spaceId(item), item]),
  );
  const accessibleRecent = [...new Set(recentIds)].flatMap((id) => {
    const item = authorized.get(id);
    // Shortcuts open the space. Its content tree appears after navigation.
    return item
      ? [{ ...item, children: undefined, childrenUnloaded: false, onExpandedChange: undefined }]
      : [];
  });
  const recent = accessibleRecent.slice(0, LIMIT);
  return [
    {
      ...group,
      label: "Spaces",
      icon: Layers,
      priority: 1000,
      items: [],
      collapsedRail: undefined,
    },
    ...(recent.length
      ? [
          {
            label: "Recent spaces",
            priority: 800,
            collapsible: true,
            defaultCollapsed: false,
            meta: { type: "recent-spaces", hideInCollapsedRail: true },
            items: [
              ...recent,
              ...(group.to && accessibleRecent.length > LIMIT
                ? [
                    {
                      to: group.to,
                      label: "Show more",
                      icon: ArrowRight,
                      meta: { recentSpacesMore: true },
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];
}
