import { describe, expect, it } from "vitest";
import { findNavItem, DEFAULT_NAV_CONFIG, type NavGroup } from "../nav-config";

describe("findNavItem", () => {
  it("finds item in default config", () => {
    const result = findNavItem(DEFAULT_NAV_CONFIG, "/");
    expect(result).not.toBeNull();
    expect(result!.group).toBe("Pages");
    expect(result!.item.label).toBe("Chat");
    expect(result!.item.description).toBeTruthy();
  });

  it("returns null for unknown path", () => {
    expect(findNavItem(DEFAULT_NAV_CONFIG, "/unknown")).toBeNull();
  });

  it("finds item across multiple groups", () => {
    const config: NavGroup[] = [
      ...DEFAULT_NAV_CONFIG,
      {
        label: "Contracts",
        items: [
          {
            to: "/contracts/123",
            label: "Acme NDA",
            icon: DEFAULT_NAV_CONFIG[0].items[0].icon,
            description: "Review NDA",
            meta: { contractId: "123" },
          },
        ],
      },
    ];

    const result = findNavItem(config, "/contracts/123");
    expect(result).not.toBeNull();
    expect(result!.group).toBe("Contracts");
    expect(result!.item.label).toBe("Acme NDA");
    expect(result!.item.meta).toEqual({ contractId: "123" });
  });

  it("returns first match when paths duplicate across groups", () => {
    const config: NavGroup[] = [
      {
        label: "A",
        items: [{ to: "/x", label: "X-A", icon: DEFAULT_NAV_CONFIG[0].items[0].icon }],
      },
      {
        label: "B",
        items: [{ to: "/x", label: "X-B", icon: DEFAULT_NAV_CONFIG[0].items[0].icon }],
      },
    ];
    const result = findNavItem(config, "/x");
    expect(result!.group).toBe("A");
  });

  it("all default config items are findable", () => {
    for (const group of DEFAULT_NAV_CONFIG) {
      for (const item of group.items) {
        const result = findNavItem(DEFAULT_NAV_CONFIG, item.to);
        expect(result).not.toBeNull();
        expect(result!.item.to).toBe(item.to);
      }
    }
  });

  it("finds deeply nested child items", () => {
    const icon = DEFAULT_NAV_CONFIG[0].items[0].icon;
    const config: NavGroup[] = [
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/root",
            label: "Workspace",
            icon,
            children: [
              {
                to: "/spaces/folder",
                label: "Folder",
                icon,
                children: [
                  {
                    to: "/spaces/entity",
                    label: "Entity",
                    icon,
                    meta: { spacesEntityId: "entity" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = findNavItem(config, "/spaces/entity");
    expect(result).not.toBeNull();
    expect(result!.item.label).toBe("Entity");
    expect(result!.item.meta).toEqual({ spacesEntityId: "entity" });
  });

  it("uses the deepest prefix match for nested routes", () => {
    const icon = DEFAULT_NAV_CONFIG[0].items[0].icon;
    const config: NavGroup[] = [
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/root",
            label: "Workspace",
            icon,
            children: [
              {
                to: "/spaces/root/views",
                label: "Views",
                icon,
                children: [
                  {
                    to: "/spaces/root/views/contradictions",
                    label: "Contradictions",
                    icon,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const result = findNavItem(config, "/spaces/root/views/contradictions/details");
    expect(result).not.toBeNull();
    expect(result!.item.label).toBe("Contradictions");
  });
});

it("resolves a record's identity while its list represents it in the sidebar", () => {
  const record = {
    to: "/s/space/first-task",
    label: "first task",
    icon: DEFAULT_NAV_CONFIG[0].items[0].icon,
    meta: { entityId: "first" },
  };
  const config = [
    {
      label: "Workspace",
      items: [
        {
          ...record,
          to: "/s/space/tasks",
          label: "Tasks",
          childrenHidden: true,
          children: [record],
        },
      ],
    },
  ];
  expect(findNavItem(config, record.to)?.item).toBe(record);
  expect(findNavItem(config, "/s/space/tasks")?.item.label).toBe("Tasks");
});
