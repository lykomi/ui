import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FolderOpen, MessageSquare } from "lucide-react";
import { useNavStore } from "../lib/nav-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import { SIDEBAR_WIDTH, useSidebarStore } from "../lib/sidebar-store.ts";
import type { NavGroup } from "../lib/nav-config.ts";
import { TooltipProvider } from "../ui/tooltip.tsx";

vi.mock("../lib/use-new-conversation.ts", () => ({
  useNewConversation: () => () => {},
}));

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

    expect(documentsButton).toBeTruthy();
    expect(viewsButton).toBeTruthy();
    expect(documentsButton?.className).toContain("pl-7");
    expect(viewsButton?.className).toContain("pl-7");
    expect(documentsButton?.className).not.toContain("pl-5");
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

    // The Sidebar mounts twice (mobile drawer + desktop rail); both render
    // the collapsed-rail group wrappers when collapsed. Group them by their
    // owning <aside> and verify the per-aside structure, not the total.
    // Filter out the outer rail container itself (which also has these
    // classes but additionally carries ``py-3``).
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
});
