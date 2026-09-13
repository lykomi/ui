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
 * The desktop sidebar. ``Sidebar`` mounts the mobile drawer AND the desktop
 * rail, each with its own expand/collapse state, so every structural query
 * below has to say which surface it means — an unscoped query would silently
 * read the off-canvas mobile copy (it renders first).
 */
function desktopSidebar(container: HTMLElement) {
  const aside = container.querySelector<HTMLElement>('[data-sidebar-surface="desktop"]');
  if (!aside) throw new Error("desktop sidebar surface not rendered");
  return aside;
}

/** The row element for a nav label — the element carrying the depth indent. */
function navRow(container: HTMLElement, label: string) {
  return Array.from(
    desktopSidebar(container).querySelectorAll<HTMLElement>("[data-nav-depth]"),
  ).find((element) => element.textContent?.includes(label));
}

/** The disclosure cell of a row — the absolutely positioned chevron/dot column. */
function twistyCell(container: HTMLElement, label: string) {
  return navRow(container, label)?.querySelector<HTMLElement>("[data-nav-twisty-cell]");
}

/**
 * Which x a nav element sits at, in Tailwind rem-quarters.
 *
 * Rows position their disclosure cell with `left-*` while the group header
 * pads to the same x with `pl-*` — two spellings of one number, so the
 * alignment assertions have to compare the NUMBER, not the class.
 */
function columnOf(element: HTMLElement | null | undefined) {
  return element?.className.match(/\b(?:left|pl)-([\d.]+)\b/)?.[1];
}

/** The leading chevron button of a row, or undefined when the row is a leaf. */
function twisty(container: HTMLElement, label: string) {
  return (
    navRow(container, label)?.querySelector<HTMLButtonElement>("[data-nav-twisty]") ?? undefined
  );
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

  it("retains expanded folders when refreshed navigation remounts a renamed row", async () => {
    const child = { to: "/folder-child", label: "Child", icon: FolderOpen };
    await renderWithItems([
      { to: "/folder-parent", label: "Parent", icon: FolderOpen, children: [child] },
    ]);
    await act(async () => twisty(container, "Parent")!.click());
    expect(navRow(container, "Child")).toBeTruthy();
    await renderWithItems([
      {
        to: "/folder-parent",
        label: "Renamed parent",
        icon: FolderOpen,
        children: [child, { to: "/new-folder", label: "New folder", icon: FolderOpen }],
      },
    ]);
    expect(navRow(container, "New folder")).toBeTruthy();
    expect(twisty(container, "Renamed parent")?.getAttribute("aria-expanded")).toBe("true");
  });

  /**
   * A tree row shows a chevron when it branches and a dot when it is a leaf.
   * That is two markers for a question with THREE answers, the third being
   * "nobody has looked" — which is the normal state of every unvisited row in
   * a nav that fetches subtrees lazily.
   */
  const renderWithItems = async (items: NavGroup["items"]) => {
    const { Sidebar } = await import("./sidebar.tsx");
    useNavStore.getState().setConfig([{ label: "Workspaces", items }]);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });
  };

  it.each([false, true])(
    "keeps a hidden list selected without rendering its records (nested=%s)",
    async (nested) => {
      const list = {
        to: "/spaces/tasks",
        label: "Tasks",
        icon: FolderOpen,
        childrenHidden: true,
        children: Array.from({ length: 1000 }, (_, i) => ({
          to: i === 0 ? "/spaces/demo" : `/spaces/task-${i}`,
          label: `Task ${i}`,
          icon: MessageSquare,
        })),
      };
      await renderWithItems(
        nested ? [{ to: "/spaces", label: "Space", icon: FolderOpen, children: [list] }] : [list],
      );
      for (const surface of container.querySelectorAll("[data-sidebar-surface]")) {
        const selected = surface.querySelector('[data-active-nav-row="true"]');
        expect(selected?.textContent).toBe("Tasks");
        expect(surface.textContent).not.toContain("Task 0");
        expect(surface.textContent).not.toContain("Task 999");
      }
      expect(twisty(container, "Tasks")).toBeUndefined();
      // A status refresh must preserve selection, and clicking the selected
      // owner must still open the list, rather than the current record.
      await act(async () => useNavStore.getState().setConfig([...useNavStore.getState().config]));
      expect(navRow(container, "Tasks")?.dataset.activeNavRow).toBe("true");
      const row = navRow(container, "Tasks")!;
      const link = row.matches("a,button") ? row : row.querySelector<HTMLElement>("a,button")!;
      await act(async () => link.click());
      expect(navRow(container, "Tasks")?.dataset.activeNavRow).toBe("true");
      expect(navRow(container, "Task 0")).toBeUndefined();
    },
  );

  it("closes the mobile drawer on navigation, including repeat selection of the current address", async () => {
    window.innerWidth = 390;
    await renderWithItems([{ to: "/spaces/demo/document", label: "Document", icon: FolderOpen }]);
    const documentLink = container.querySelector<HTMLAnchorElement>(
      '[data-sidebar-surface="mobile"] a[href="/spaces/demo/document"]',
    );
    expect(documentLink).toBeTruthy();
    for (let i = 0; i < 2; i++) {
      await act(async () => useSidebarStore.getState().toggleMobile());
      expect(useSidebarStore.getState().isMobileOpen).toBe(true);
      await act(async () => documentLink!.click());
      expect(useSidebarStore.getState().isMobileOpen).toBe(false);
    }
  });

  it("marks the unvisited workspace as unknown, not as a leaf", async () => {
    // Chris's case: one workspace selected (tree fetched, so it branches),
    // the other never opened. `groupHasBranches` turns the whole group into a
    // tree because of the FIRST one, and the second then drew the leaf dot —
    // "nothing under this one" — on the strength of a fetch that never
    // happened. Select it and the dot became a chevron.
    await renderWithItems([
      {
        to: "/spaces/active",
        label: "Active Workspace",
        icon: FolderOpen,
        children: [{ to: "/spaces/active/docs", label: "Documents", icon: FolderOpen }],
      },
      {
        to: "/spaces/unvisited",
        label: "Unvisited Workspace",
        icon: FolderOpen,
        childrenUnloaded: true,
      },
      { to: "/spaces/known-empty", label: "Known Empty", icon: FolderOpen },
    ]);

    // The loaded one branches.
    expect(
      twistyCell(container, "Active Workspace")?.querySelector("[data-nav-twisty]"),
    ).toBeTruthy();

    // The unvisited one says nothing at all — no dot, no chevron — while
    // still holding its column so the labels stay on one grid.
    const unvisited = twistyCell(container, "Unvisited Workspace");
    expect(unvisited).toBeTruthy();
    expect(unvisited?.querySelector("[data-nav-leaf-dot]")).toBeNull();
    expect(unvisited?.querySelector("[data-nav-twisty]")).toBeNull();

    // A row genuinely known to be empty still earns the leaf dot — the fix
    // must not simply delete the marker everywhere.
    expect(twistyCell(container, "Known Empty")?.querySelector("[data-nav-leaf-dot]")).toBeTruthy();
  });

  it("prefers the chevron when children are present despite the flag", async () => {
    // Loaded children win — the flag describes ignorance, not a display mode.
    await renderWithItems([
      {
        to: "/spaces/full",
        label: "Loaded Workspace",
        icon: FolderOpen,
        childrenUnloaded: true,
        children: [{ to: "/spaces/full/docs", label: "Documents", icon: FolderOpen }],
      },
    ]);

    const cell = twistyCell(container, "Loaded Workspace");
    expect(cell?.querySelector("[data-nav-twisty]")).toBeTruthy();
    expect(cell?.querySelector("[data-nav-leaf-dot]")).toBeNull();
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

    // Depth is what the two share — a leaf and a folder at the same level
    // put their disclosure cell in the same column, so the tree reads as
    // one ladder rather than two.
    const documentsRow = navRow(container, "Documents");
    const viewsRow = navRow(container, "Views");

    expect(documentsRow).toBeTruthy();
    expect(viewsRow).toBeTruthy();
    expect(documentsRow?.dataset.navDepth).toBe("1");
    expect(viewsRow?.dataset.navDepth).toBe("1");
    expect(columnOf(twistyCell(container, "Documents"))).toBe("5");
    expect(columnOf(twistyCell(container, "Views"))).toBe("5");
  });

  it("gives a flat list no leaf dots — nothing there can branch", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    // No item here has children, so a dot on every row would mark a
    // distinction that does not exist and read as a bullet list.
    useNavStore.getState().setConfig([
      {
        label: "Chats",
        items: [
          { to: "/activity", label: "Activity", icon: MessageSquare },
          { to: "/threads/1", label: "A chat", icon: MessageSquare },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/activity"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // The cell still renders — flat rows keep the same label column as
    // tree rows — but it is empty.
    expect(twistyCell(container, "Activity")).toBeTruthy();
    expect(twistyCell(container, "Activity")?.children.length).toBe(0);
    expect(twistyCell(container, "A chat")?.children.length).toBe(0);
  });

  it("keeps leaf dots in a group that does branch", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    // One sibling has children, so "no children" is now a real
    // distinction and the leaves say so.
    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        items: [
          { to: "/flat", label: "Flat item", icon: MessageSquare },
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
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    expect(twistyCell(container, "Flat item")?.children.length).toBe(1);
  });

  it("focuses a group on one item: the header leads back, the item is a heading, siblings hide", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    // A group focused on one subject: its header becomes the way back and
    // keeps its metrics; the subject is a flat heading; its children are the
    // tree beneath, one step further left than under a branch, at the row
    // size they have anywhere else; its siblings are not drawn. Focus wins
    // over ``collapsible``.
    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        to: "/overview",
        collapsible: true,
        description: "Back to every workspace",
        focusOn: "/spaces/demo",
        items: [
          {
            to: "/spaces/demo",
            label: "Demo Workspace",
            icon: FolderOpen,
            children: [
              {
                to: "/spaces/demo/documents",
                label: "Documents",
                icon: FolderOpen,
                children: [{ to: "/spaces/demo/documents/a", label: "A file", icon: FolderOpen }],
              },
              { to: "/spaces/demo/notes", label: "Notes", icon: FolderOpen },
            ],
          },
          { to: "/spaces/other", label: "Other Workspace", icon: FolderOpen },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo/documents"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // The header is the way back: a link to the group's page carrying the
    // label in the header's own typography, a back chevron in the chevron's
    // column, and no collapse toggle even though the group is collapsible.
    const back =
      desktopSidebar(container).querySelector<HTMLAnchorElement>("[data-nav-group-back]");
    expect(back?.getAttribute("href")).toBe("/overview");
    expect(back?.textContent).toContain("Workspaces");
    expect(back?.querySelector("svg")).toBeTruthy();
    expect(back?.querySelector("span:last-child")?.className).toMatch(/\buppercase\b/);
    expect(desktopSidebar(container).querySelector("[data-nav-group-toggle]")).toBeNull();
    // Siblings are not drawn.
    expect(navRow(container, "Other Workspace")).toBeUndefined();
    // The heading: flat under the chevron's column, emphasised like a
    // section label, no chevron, always open.
    expect(twisty(container, "Demo Workspace")).toBeUndefined();
    expect(twistyCell(container, "Demo Workspace")?.children.length).toBe(0);
    const headingBody = navRow(container, "Demo Workspace")?.querySelector<HTMLElement>(
      "button:not([data-nav-twisty])",
    );
    expect(headingBody?.className).toMatch(/\bpl-3\b/);
    expect(headingBody?.className).toMatch(/\bfont-semibold\b/);
    // Its children are the tree, one step left of a branch's children: the
    // depth-0 column, with a chevron on the branch and a dot on the leaf.
    expect(navRow(container, "Documents")?.dataset.navDepth).toBe("0");
    expect(navRow(container, "Notes")?.dataset.navDepth).toBe("0");
    expect(twisty(container, "Documents")).toBeTruthy();
    expect(twistyCell(container, "Notes")?.querySelector("[data-nav-leaf-dot]")).toBeTruthy();
    expect(columnOf(twistyCell(container, "Notes"))).toBe("3");
  });

  it("draws a group as usual when focusOn names no item, or there is no header to lead back from", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        to: "/overview",
        focusOn: "/spaces/missing",
        items: [
          { to: "/spaces/demo", label: "Demo Workspace", icon: FolderOpen },
          { to: "/spaces/other", label: "Other Workspace", icon: FolderOpen },
        ],
      },
      {
        label: "Pages",
        hideLabel: true,
        to: "/",
        focusOn: "/activity",
        items: [
          { to: "/activity", label: "Activity", icon: MessageSquare },
          { to: "/threads", label: "Threads", icon: MessageSquare },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    expect(desktopSidebar(container).querySelector("[data-nav-group-back]")).toBeNull();
    expect(navRow(container, "Other Workspace")).toBeTruthy();
    expect(navRow(container, "Threads")).toBeTruthy();
  });

  it("indents rows under a visible header, and leaves header-less rows flush", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    // Under a header a row's icon sits under the header label, like a tree
    // row's does, so the group reads as a group; in a header-less group
    // there is nothing to indent under and the rows sit with the sidebar's
    // other flat chrome.
    useNavStore.getState().setConfig([
      {
        label: "Pages",
        hideLabel: true,
        items: [{ to: "/activity", label: "Activity", icon: MessageSquare }],
      },
      {
        label: "Build",
        items: [{ to: "/build/apps", label: "Apps", icon: MessageSquare }],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/activity"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    expect(navRow(container, "Activity")?.className).toMatch(/\bpl-3\b/);
    expect(navRow(container, "Apps")?.className).toMatch(/\bpl-8\b/);
    // The header's hover box carries the same inset and outline as a row.
    const header = desktopSidebar(container).querySelector<HTMLElement>("[data-nav-group-header]");
    expect(header?.className).toMatch(/\bpl-3\b/);
    expect(header?.className).toMatch(/\brounded-xl\b/);
    expect(header?.className).toMatch(/\bborder-transparent\b/);
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
    expect(columnOf(twistyCell(container, "Demo Workspace"))).toBe("3");
    expect(columnOf(twistyCell(container, "Views"))).toBe("5");
    expect(columnOf(twistyCell(container, "Current"))).toBe("7");
  });

  it("leaves the whole row clickable — the disclosure cell is not a dead zone", async () => {
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
              {
                to: "/spaces/demo/readme",
                label: "Readme",
                icon: MessageSquare,
                // A leaf WITH actions renders as wrapper + button rather than
                // one button, which is where a dead disclosure cell would show
                // up first.
                actions: [{ icon: FolderOpen, label: "Rename", handler: () => {} }],
              },
            ],
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

    // The indent belongs to the navigate button, and the leaf dot floats over
    // it without taking clicks. Put the indent on the wrapper instead and
    // every pixel left of the icon silently stops navigating — jsdom has no
    // hit-testing, so only this structural check catches it here (the browser
    // pass clicks the cell for real).
    const row = navRow(container, "Readme");
    const cell = twistyCell(container, "Readme");
    const body = row?.querySelector<HTMLElement>("button:not([data-nav-twisty])");

    expect(cell?.className).toContain("pointer-events-none");
    expect(cell?.className).toContain("absolute");
    expect(columnOf(row)).toBeUndefined();
    expect(body?.className).toContain("pl-10");
  });

  it("keeps the group-header chevron in the same column as depth-0 twisties", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        collapsible: true,
        items: [{ to: "/spaces/demo", label: "Demo Workspace", icon: FolderOpen }],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/demo"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // One vertical line for every chevron in the sidebar. The header derives
    // its left padding from the same depth-0 rung the rows use, so retuning
    // the indent ladder can never desync the two columns unnoticed.
    // The header's own box carries the inset now — the hover surface spans
    // the row like an item row's — so that is where the column is read.
    const header = desktopSidebar(container).querySelector<HTMLElement>("[data-nav-group-header]");
    expect(columnOf(header)).toBe("3");
    expect(columnOf(twistyCell(container, "Demo Workspace"))).toBe("3");
  });

  it("reserves hover clearance only on rows that actually have an actions menu", async () => {
    const { Sidebar } = await import("./sidebar.tsx");

    useNavStore.getState().setConfig([
      {
        label: "Workspaces",
        items: [
          {
            to: "/spaces/plain",
            label: "Plain Folder",
            icon: FolderOpen,
            children: [{ to: "/spaces/plain/a", label: "Plain Child", icon: MessageSquare }],
          },
          {
            to: "/spaces/acted",
            label: "Folder With Actions",
            icon: FolderOpen,
            actions: [{ icon: FolderOpen, label: "Rename", handler: () => {} }],
            children: [{ to: "/spaces/acted/a", label: "Acted Child", icon: MessageSquare }],
          },
        ],
      },
    ]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spaces/plain"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>,
      );
    });

    // Padding reserved for a control that never appears makes the label
    // truncate and un-truncate on every hover, for nothing.
    const navigateButton = (label: string) =>
      navRow(container, label)?.querySelector<HTMLElement>("button:not([data-nav-twisty])");

    expect(navigateButton("Plain Folder")?.className).not.toContain("group-hover:pr-");
    expect(navigateButton("Folder With Actions")?.className).toContain("group-hover:pr-11");
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
        ((query: string) => ({
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
    useNavStore.setState({ groups: [], config: [] } as Parameters<typeof useNavStore.setState>[0]);
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
    const headers = Array.from(container.querySelectorAll<HTMLElement>("[data-nav-group-label]"));
    return headers.findIndex((el) => el.getAttribute("data-nav-group-label") === label);
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
    const persisted = JSON.parse(localStorage.getItem("sidebar-nav-collapsed") ?? "{}");
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

    const header = container.querySelector<HTMLElement>('[data-nav-group-label="Recents"]');
    expect(header).toBeTruthy();
    // The bubbled-up dot is rendered with the same status-dot marker
    // as a child status dot; scope the lookup to the header.
    const bubble = header!.querySelector<HTMLElement>("[data-nav-status-dot]");
    expect(bubble).toBeTruthy();
  });
});
