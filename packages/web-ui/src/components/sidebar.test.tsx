import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AlertTriangle, FolderOpen, MessageSquare } from "lucide-react";
import { useNavStore } from "../lib/nav-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import { SIDEBAR_WIDTH, useSidebarStore } from "../lib/sidebar-store.ts";
import type { NavGroup } from "../lib/nav-config.ts";
import { TooltipProvider } from "../ui/tooltip.tsx";

vi.mock("../lib/use-new-conversation.ts", () => ({
  useNewConversation: () => () => {},
}));

/**
 * The row element for a nav label — the element carrying the depth indent.
 *
 * Scoped to the FIRST ``<nav>``: the Sidebar mounts a desktop and a mobile
 * instance (one hidden by CSS), each with its own expand/collapse state, so
 * an unscoped query silently mixes the two.
 */
function navRow(container: HTMLElement, label: string) {
  const nav = container.querySelector<HTMLElement>("nav") ?? container;
  return Array.from(nav.querySelectorAll<HTMLElement>("[data-nav-depth]")).find((element) =>
    element.textContent?.includes(label),
  );
}

/** The leading chevron button of a row, or undefined when the row is a leaf. */
function twisty(container: HTMLElement, label: string) {
  return navRow(container, label)?.querySelector<HTMLButtonElement>("[data-nav-twisty]") ?? undefined;
}

describe("Sidebar active state", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;
  let originalInnerWidth: number;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    originalInnerWidth = window.innerWidth;
    originalMatchMedia = window.matchMedia;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    window.innerWidth = 1280;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value:
        originalMatchMedia ||
        ((query: string) =>
          ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          }) as MediaQueryList),
    });

    const navConfig: NavGroup[] = [
      {
        label: "Pages",
        hideLabel: true,
        items: [
          { to: "/", label: "Chat", icon: MessageSquare },
          { to: "/spaces/demo", label: "Demo Workspace", icon: FolderOpen },
        ],
      },
    ];

    useNavStore.getState().setConfig(navConfig);
    useNavStore.setState({ footerActions: [] });
    useAppStore.setState({
      currentPage: "/spaces/demo",
      threadActive: false,
      contextItems: [],
      sentContext: {},
      highlights: [],
      selectedItemId: null,
      content: {},
    });
    useSidebarStore.setState({ isOpen: true, isMobileOpen: false, width: SIDEBAR_WIDTH });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    window.innerWidth = originalInnerWidth;
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      // jsdom doesn't define this by default; remove our temporary override.
      // @ts-expect-error deleting configurable test override
      delete window.matchMedia;
    }
  });

  it("uses the neutral selected-row styling for the current nav item", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    const activeRow = Array.from(container.querySelectorAll<HTMLElement>("[class]")).find(
      (element) =>
        element.textContent?.includes("Demo Workspace") &&
        element.className.includes("bg-sidebar-selected"),
    );

    expect(activeRow).toBeTruthy();
    expect(activeRow?.className).toContain("bg-sidebar-selected");
    expect(activeRow?.className).not.toContain("bg-sidebar-primary/10");
  });

  it("renders first-level child leaves and folders at the same indent depth", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    const navConfig: NavGroup[] = [
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/demo",
            label: "Demo Workspace",
            icon: FolderOpen,
            children: [
              { to: "/spaces/demo/documents", label: "Documents", icon: FolderOpen },
              {
                to: "/spaces/demo/views",
                label: "Views",
                icon: FolderOpen,
                children: [
                  { to: "/spaces/demo/views/current", label: "Current", icon: FolderOpen },
                ],
              },
            ],
          },
        ],
      },
    ];

    useNavStore.getState().setConfig(navConfig);
    useAppStore.setState({
      currentPage: "/spaces/demo/documents",
      threadActive: false,
      contextItems: [],
      sentContext: {},
      highlights: [],
      selectedItemId: null,
      content: {},
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo/documents"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    const documentsButton = Array.from(container.querySelectorAll("button")).find((element) =>
      element.textContent?.includes("Documents"),
    );
    const viewsButton = Array.from(container.querySelectorAll("button")).find((element) =>
      element.textContent?.includes("Views"),
    );

    // The indent lives on the ROW (``data-nav-depth``), not on the inner
    // navigate button — the leading twisty cell is a sibling of that
    // button, so the row is what positions the whole cluster.
    const documentsRow = navRow(container, "Documents");
    const viewsRow = navRow(container, "Views");

    expect(documentsRow).toBeTruthy();
    expect(viewsRow).toBeTruthy();
    expect(documentsRow?.dataset.navDepth).toBe("1");
    expect(viewsRow?.dataset.navDepth).toBe("1");
    expect(documentsRow?.className).toContain("pl-5");
    expect(viewsRow?.className).toContain("pl-5");
  });

  it("marks branches with a chevron and leaves with a dot (Confluence page-tree)", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/demo",
            label: "Demo Workspace",
            icon: FolderOpen,
            children: [
              { to: "/spaces/demo/readme", label: "Readme", icon: MessageSquare },
              {
                to: "/spaces/demo/views",
                label: "Views",
                icon: FolderOpen,
                children: [
                  { to: "/spaces/demo/views/current", label: "Current", icon: MessageSquare },
                ],
              },
            ],
          },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo/views/current"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // Branch rows own a twisty button; leaf rows own a non-interactive dot.
    expect(twisty(container, "Demo Workspace")).toBeTruthy();
    expect(twisty(container, "Views")).toBeTruthy();
    expect(twisty(container, "Readme")).toBeFalsy();
    expect(twisty(container, "Current")).toBeFalsy();

    // The affordance is visible at rest, not gated behind :hover — that is
    // the whole point of moving it out of the hover-only row controls.
    expect(twisty(container, "Views")?.className).not.toContain("opacity-0");

    // Route-derived expansion: both ancestors of the active page are open.
    expect(twisty(container, "Demo Workspace")?.getAttribute("aria-expanded")).toBe("true");
    expect(twisty(container, "Views")?.getAttribute("aria-expanded")).toBe("true");

    // One indent rung per level, so the twisty column tracks the depth.
    expect(navRow(container, "Demo Workspace")?.className).toContain("pl-3");
    expect(navRow(container, "Views")?.className).toContain("pl-5");
    expect(navRow(container, "Current")?.className).toContain("pl-7");
  });

  it("clicking a twisty collapses the branch without navigating", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/demo",
            label: "Demo Workspace",
            icon: FolderOpen,
            children: [{ to: "/spaces/demo/readme", label: "Readme", icon: MessageSquare }],
          },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo/readme"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    expect(navRow(container, "Readme")).toBeTruthy();

    await act(async () => {
      twisty(container, "Demo Workspace")?.click();
    });

    expect(twisty(container, "Demo Workspace")?.getAttribute("aria-expanded")).toBe("false");
    expect(navRow(container, "Readme")).toBeFalsy();

    await act(async () => {
      twisty(container, "Demo Workspace")?.click();
    });

    expect(navRow(container, "Readme")).toBeTruthy();
  });

  it("collapsed rail wraps each nav group and adds a top border between groups", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    const navConfig: NavGroup[] = [
      {
        label: "Pages",
        hideLabel: true,
        items: [{ to: "/", label: "Chat", icon: MessageSquare }],
      },
      {
        label: "Workspaces",
        items: [{ to: "/spaces/demo", label: "Demo Workspace", icon: FolderOpen }],
      },
      {
        label: "Admin",
        items: [{ to: "/spaces/admin/workspaces", label: "Workspaces", icon: FolderOpen }],
      },
    ];

    useNavStore.getState().setConfig(navConfig);
    useAppStore.setState({
      currentPage: "/",
      threadActive: false,
      contextItems: [],
      sentContext: {},
      highlights: [],
      selectedItemId: null,
      content: {},
    });
    // Collapse the sidebar so the rail renders.
    useSidebarStore.setState({ isOpen: false, isMobileOpen: false, width: SIDEBAR_WIDTH });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // Sidebar renders twice (mobile drawer + desktop rail) but only the
    // desktop rail uses ``collapsed={true}`` — the mobile drawer always
    // renders ``collapsed={false}``, so it doesn't emit collapsed-rail
    // group wrappers. Grouping the matched divs by owning <aside> handles
    // the (unlikely) case where multiple instances do contribute.
    // Filter out the outer rail container itself (which has these classes
    // but additionally carries ``py-3``).
    const wrappersByAside = new Map<Element, HTMLDivElement[]>();
    container
      .querySelectorAll<HTMLDivElement>("div.flex.flex-col.items-center.gap-1")
      .forEach((el) => {
        if (el.className.includes("py-3")) return;
        const aside = el.closest("aside");
        if (!aside) return;
        const list = wrappersByAside.get(aside) ?? [];
        list.push(el);
        wrappersByAside.set(aside, list);
      });

    // Each rendered sidebar instance must have one wrapper per nav group —
    // first plain, second + third with the separator border.
    const perAside = Array.from(wrappersByAside.values());
    expect(perAside.length).toBeGreaterThan(0);
    for (const wrappers of perAside) {
      expect(wrappers.length).toBe(3);
      expect(wrappers[0].className).not.toContain("border-t");
      expect(wrappers[1].className).toContain("border-t");
      expect(wrappers[1].className).toContain("mt-2");
      expect(wrappers[1].className).toContain("pt-2");
      expect(wrappers[2].className).toContain("border-t");
    }
  });

  it("collapsed rail keeps the first VISIBLE group plain when an earlier group renders nothing", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    // The first group supplies a `collapsedRail` that returns no items —
    // simulates an early-load state where a module hasn't populated yet.
    // The rendering must skip it entirely AND must not push a border-top
    // onto whatever group renders first.
    const navConfig: NavGroup[] = [
      {
        label: "EmptyFirst",
        items: [{ to: "/empty", label: "Empty", icon: MessageSquare }],
        collapsedRail: () => [],
      },
      {
        label: "Workspaces",
        items: [{ to: "/spaces/demo", label: "Demo", icon: FolderOpen }],
      },
      {
        label: "Admin",
        items: [{ to: "/spaces/admin", label: "Admin", icon: FolderOpen }],
      },
    ];

    useNavStore.getState().setConfig(navConfig);
    useAppStore.setState({
      currentPage: "/",
      threadActive: false,
      contextItems: [],
      sentContext: {},
      highlights: [],
      selectedItemId: null,
      content: {},
    });
    useSidebarStore.setState({ isOpen: false, isMobileOpen: false, width: SIDEBAR_WIDTH });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    const wrappersByAside = new Map<Element, HTMLDivElement[]>();
    container
      .querySelectorAll<HTMLDivElement>("div.flex.flex-col.items-center.gap-1")
      .forEach((el) => {
        if (el.className.includes("py-3")) return;
        const aside = el.closest("aside");
        if (!aside) return;
        const list = wrappersByAside.get(aside) ?? [];
        list.push(el);
        wrappersByAside.set(aside, list);
      });

    const perAside = Array.from(wrappersByAside.values());
    expect(perAside.length).toBeGreaterThan(0);
    for (const wrappers of perAside) {
      // Empty group skipped → 2 visible wrappers
      expect(wrappers.length).toBe(2);
      // First VISIBLE wrapper has no separator (despite being array-idx 1)
      expect(wrappers[0].className).not.toContain("border-t");
      // Second visible wrapper carries the divider
      expect(wrappers[1].className).toContain("border-t");
    }
  });

  it("renders NavItem.statusIcon with tone class + tooltip label", async () => {
    // The statusIcon slot is consumer-driven (e.g. ``spaces-web-ui``
    // stamps a warning triangle on workspaces with failed indexing).
    // This test pins three things the consumer relies on:
    //   1. The supplied LucideIcon component is rendered.
    //   2. The tone maps to the right Tailwind class (``warning`` →
    //      ``text-warning``).
    //   3. The ``label`` lands on both ``aria-label`` and the
    //      ``title`` attribute so the icon gets a hover tooltip and
    //      a screen-reader announcement without the consumer having
    //      to wire anything else.
    const { Sidebar } = await import("./sidebar.tsx");

    const navConfig: NavGroup[] = [
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/wsA",
            label: "Workspace With Failures",
            icon: FolderOpen,
            statusIcon: {
              icon: AlertTriangle,
              tone: "warning",
              label: "3 documents failed to index",
            },
          },
          {
            to: "/spaces/wsB",
            label: "Healthy Workspace",
            icon: FolderOpen,
          },
        ],
      },
    ];
    useNavStore.getState().setConfig(navConfig);
    useAppStore.setState({
      currentPage: "/spaces/wsA",
      threadActive: false,
      contextItems: [],
      sentContext: {},
      highlights: [],
      selectedItemId: null,
      content: {},
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/wsA"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // The warning row carries the icon wrapped in a span. The label
    // lands on both ``aria-label`` (screen reader) and ``title``
    // (hover tooltip) on the wrapping span; the inner svg carries
    // the tone class.
    const warningWrappers = container.querySelectorAll<HTMLElement>(
      'span[aria-label="3 documents failed to index"]',
    );
    expect(warningWrappers.length).toBeGreaterThan(0);
    const wrapper = warningWrappers[0];
    expect(wrapper.getAttribute("title")).toBe("3 documents failed to index");
    expect(wrapper.querySelector("svg.text-warning")).not.toBeNull();

    // No statusIcon on the healthy workspace ⇒ its leaf row
    // contains no warning svg. Workspaces are rendered as NavLink
    // anchors (button is for folders), so scope to ``a, button``
    // and reject ancestor containers that happen to enclose BOTH
    // workspaces.
    const healthyRowLeaves = Array.from(
      container.querySelectorAll<HTMLElement>("a, button"),
    ).filter((el) => el.textContent?.includes("Healthy Workspace"));
    expect(healthyRowLeaves.length).toBeGreaterThan(0);
    for (const leaf of healthyRowLeaves) {
      expect(leaf.querySelectorAll("svg.text-warning").length).toBe(0);
    }
  });

  it("scrolls an offscreen active row into the visible nav container", async () => {
    const { _scrollNavRowIntoViewForTest } = await import("./sidebar.tsx");
    const nav = document.createElement("nav");
    const row = document.createElement("div");

    Object.defineProperty(nav, "clientHeight", { configurable: true, value: 700 });
    Object.defineProperty(nav, "scrollTop", { configurable: true, writable: true, value: 3000 });
    nav.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 800,
        left: 0,
        right: 248,
        width: 248,
        height: 700,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    row.getBoundingClientRect = () =>
      ({
        top: -373,
        bottom: -335,
        left: 4,
        right: 243,
        width: 239,
        height: 38,
        x: 4,
        y: -373,
        toJSON: () => ({}),
      }) as DOMRect;

    _scrollNavRowIntoViewForTest(nav, row);

    expect(nav.scrollTop).toBe(2196);
  });
});

describe("Sidebar group priority + collapse + status bubble-up", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: boolean | undefined;
  let originalInnerWidth: number;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    originalInnerWidth = window.innerWidth;
    originalMatchMedia = window.matchMedia;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    window.innerWidth = 1280;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value:
        originalMatchMedia ||
        ((query: string) =>
          ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          })),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
    useSidebarStore.setState({ collapsed: false, width: SIDEBAR_WIDTH });
    useNavStore.setState({ groups: [], config: [] } as Parameters<
      typeof useNavStore.setState
    >[0]);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    window.innerWidth = originalInnerWidth;
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      // @ts-expect-error deleting configurable test override
      delete window.matchMedia;
    }
  });

  function indexOfLabel(label: string): number {
    const headers = Array.from(
      container.querySelectorAll<HTMLElement>("[data-nav-group-label]"),
    );
    return headers.findIndex(
      (el) => el.getAttribute("data-nav-group-label") === label,
    );
  }

  it("sorts groups by NavGroup.priority desc (higher priority first)", async () => {
    const { Sidebar } = await import("./sidebar.tsx");
    const navConfig: NavGroup[] = [
      {
        label: "Low",
        priority: 10,
        items: [{ to: "/low", label: "Low item", icon: FolderOpen }],
      },
      {
        label: "High",
        priority: 100,
        items: [{ to: "/high", label: "High item", icon: FolderOpen }],
      },
      {
        label: "Mid",
        priority: 50,
        items: [{ to: "/mid", label: "Mid item", icon: FolderOpen }],
      },
    ];
    useNavStore.getState().setConfig(navConfig);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    const idxHigh = indexOfLabel("High");
    const idxMid = indexOfLabel("Mid");
    const idxLow = indexOfLabel("Low");
    expect(idxHigh).toBeGreaterThanOrEqual(0);
    expect(idxMid).toBeGreaterThan(idxHigh);
    expect(idxLow).toBeGreaterThan(idxMid);
  });

  it("collapsing a group hides its children and persists to localStorage", async () => {
    const { Sidebar } = await import("./sidebar.tsx");
    const navConfig: NavGroup[] = [
      {
        label: "Recents",
        collapsible: true,
        items: [
          { to: "/chat/1", label: "First chat", icon: MessageSquare },
          { to: "/chat/2", label: "Second chat", icon: MessageSquare },
        ],
      },
    ];
    useNavStore.getState().setConfig(navConfig);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // Children visible initially (count varies — the sidebar may
    // also render an icon-only tooltip mirror in jsdom; we only care
    // that "First chat" appears at least once now and disappears
    // after collapse).
    const childTextBefore = container.textContent ?? "";
    expect(childTextBefore).toContain("First chat");
    expect(childTextBefore).toContain("Second chat");

    // Click the group header toggle button.
    const headerToggle = container.querySelector<HTMLElement>(
      '[data-nav-group-label="Recents"] [data-nav-group-toggle]',
    );
    expect(headerToggle).toBeTruthy();
    await act(async () => {
      headerToggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Children gone after collapse.
    const childTextAfter = container.textContent ?? "";
    expect(childTextAfter).not.toContain("First chat");
    expect(childTextAfter).not.toContain("Second chat");

    // Persisted to localStorage under the generic package-scoped key.
    const persisted = JSON.parse(
      localStorage.getItem("sidebar-nav-collapsed") ?? "{}",
    );
    expect(persisted.Recents).toBe(true);
  });

  it("child statusDot bubbles up to the collapsed group header", async () => {
    const { Sidebar } = await import("./sidebar.tsx");
    const navConfig: NavGroup[] = [
      {
        label: "Recents",
        collapsible: true,
        defaultCollapsed: true,
        items: [
          {
            to: "/chat/active",
            label: "Active chat",
            icon: MessageSquare,
            statusDot: { tone: "primary", srLabel: "active" },
          },
          { to: "/chat/idle", label: "Idle chat", icon: MessageSquare },
        ],
      },
    ];
    useNavStore.getState().setConfig(navConfig);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    const header = container.querySelector<HTMLElement>(
      '[data-nav-group-label="Recents"]',
    );
    expect(header).toBeTruthy();
    // The bubbled-up dot is rendered with the same status-dot marker
    // as a child status dot; scope the lookup to the header.
    const bubble = header!.querySelector<HTMLElement>("[data-nav-status-dot]");
    expect(bubble).toBeTruthy();
  });
});
