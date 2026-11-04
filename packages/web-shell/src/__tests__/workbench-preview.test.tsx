import { Link, MemoryRouter } from "react-router";
import { Folder, MessageSquare } from "lucide-react";
import type { NavGroup } from "@iloveagents/foundry-web-ui";
import { type ReactNode, useContext, useEffect } from "react";
import { ChatContentDefaultsContext } from "../../../web-ui/dist/components/chat-content-defaults.js";
import {
  act,
  cleanup,
  fireEvent,
  render as renderUI,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNavStore as actualNavStore } from "../../../web-ui/dist/lib/nav-store.js";
import { registerChatSlots } from "../../../web-ui/dist/components/chat-slots.js";
import { WorkbenchLayoutProvider } from "../../../web-ui/dist/workbench/layout-state.js";

const state = vi.hoisted(() => ({
  navLoading: false,
  resize: (_width: number) => {},
  unmount: vi.fn(),
  groups: [] as NavGroup[],
  empty: false,
  running: false,
  panelOpen: false,
  navContext: { label: "Document", meta: {} as Record<string, unknown> },
  sidebar: vi.fn(),
}));
vi.mock("../../../web-ui/dist/components/ag-ui-runtime-provider.js", () => ({
  useAGUIAdapter: () => ({ selectRetainedThread: () => false }),
}));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (select: (s: unknown) => unknown) =>
    select({
      thread: { messages: state.empty ? [] : [{}], isRunning: state.running, isLoading: false },
      composer: { text: "" },
    }),
}));
vi.mock("@iloveagents/foundry-web-ui", () => ({
  Sidebar: (props: unknown) => {
    state.sidebar(props);
    return null;
  },
  useAppStore: (select: (s: unknown) => unknown) =>
    select({ currentPage: "/document", navContext: state.navContext }),
  useSidebarStore: (select: (s: unknown) => unknown) => select({ toggleMobile: vi.fn() }),
  TooltipIconButton: ({
    tooltip,
    children,
    ...props
  }: import("react").ComponentProps<"button"> & { tooltip: string }) => (
    <button {...props} title={tooltip}>
      {children}
    </button>
  ),
  ThemeToggle: () => null,
  UserMenu: () => null,
  useNavStore: (select: (s: unknown) => unknown) =>
    select({ config: state.groups, navLoading: state.navLoading }),
  useNewConversation: () => vi.fn(),
  ChatContent: () => {
    const { emptyState, composerIntro, composerFooter, centerComposer } =
      useContext(ChatContentDefaultsContext) ?? {};
    return (
      <>
        {state.empty && (centerComposer ? composerIntro : emptyState)}
        <textarea aria-label="Chat draft" />
        {composerFooter}
      </>
    );
  },
  ToolPanelLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
  useToolPanelStore: (select: (s: unknown) => unknown) =>
    select({ isOpen: state.panelOpen, closePanel: vi.fn() }),
  useChatBubbleStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ isOpen: false, isExpanded: false }),
    { getState: () => ({ close: vi.fn() }) },
  ),
}));
import { WorkbenchPreview } from "@iloveagents/foundry-web-ui/workbench";

function Editor() {
  useEffect(() => () => state.unmount(), []);
  return <input aria-label="Unsaved field" defaultValue="Original" />;
}

beforeEach(() => {
  state.unmount.mockClear();
  state.sidebar.mockClear();
  state.groups = [];
  state.navLoading = false;
  actualNavStore.setState({ navLoading: false });
  registerChatSlots({ homeStarters: null });
  state.empty = false;
  state.running = false;
  state.panelOpen = false;
  state.navContext = { label: "Document", meta: {} };
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: (entries: unknown[]) => void) {
        state.resize = (width) => callback([{ contentRect: { width } }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("layout preview", () => {
  it("keeps a newly mounted conversation expanded after New chat", () => {
    const view = render(
      <WorkbenchLayoutProvider>
        <WorkbenchPreview key="first" page={<Editor />} />
      </WorkbenchLayoutProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand chat" }));
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    view.rerender(
      <WorkbenchLayoutProvider>
        <WorkbenchPreview key="next" page={<Editor />} />
      </WorkbenchLayoutProvider>,
    );
    expect(screen.getByLabelText("Assistant conversation").style.width).not.toBe("44px");
    expect(screen.getByRole("button", { name: "Collapse chat" })).toBeTruthy();
  });

  it("starts collapsed by default and keeps drafts mounted when expanded", () => {
    render(<WorkbenchPreview page={<Editor />} />);
    const assistant = screen.getByLabelText("Assistant conversation");
    const draft = screen.getByLabelText("Chat draft") as HTMLTextAreaElement;
    expect(assistant.style.width).toBe("44px");
    fireEvent.click(screen.getByRole("button", { name: "Expand chat" }));
    expect(assistant.style.width).not.toBe("44px");
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
  });

  it("keeps chat-only routes expanded and restores the configured side-chat default", () => {
    const view = render(<WorkbenchPreview defaultSideChatCollapsed chatOnly page={null} />);
    const assistant = screen.getByLabelText("Assistant conversation");
    expect(assistant.style.width).toBe("100%");
    expect(assistant.hasAttribute("data-chat-collapsed")).toBe(false);
    view.rerender(<WorkbenchPreview defaultSideChatCollapsed page={<Editor />} />);
    expect(assistant.style.width).toBe("44px");
    fireEvent.click(screen.getByRole("button", { name: "Expand chat" }));
    view.rerender(<WorkbenchPreview defaultSideChatCollapsed page={<Editor />} />);
    expect(assistant.style.width).not.toBe("44px");
  });

  it("shows content on compact screens and opens chat through the pane switcher", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    render(<WorkbenchPreview defaultSideChatCollapsed page={<Editor />} />);
    expect(screen.getByLabelText("Assistant conversation").style.display).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByLabelText("Assistant conversation").style.display).toBe("flex");
    expect(
      screen.getByLabelText("Assistant conversation").hasAttribute("data-chat-collapsed"),
    ).toBe(false);
  });

  it("reveals a tool result on a chat-only route", () => {
    state.panelOpen = true;
    render(
      <WorkbenchPreview defaultSideChatCollapsed={false} chatOnly page={<div>Tool result</div>} />,
    );
    expect(screen.getByLabelText("Working content").style.display).toBe("flex");
    expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(false);
  });

  it("shows one full-width pane in narrow containers, preserving drafts and reopening content on navigation", () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    render(
      <>
        <Link to="/document">Open document</Link>
        <WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />
      </>,
    );
    const editor = screen.getByLabelText("Unsaved field") as HTMLInputElement;
    const draft = screen.getByLabelText("Chat draft") as HTMLTextAreaElement;
    const content = screen.getByLabelText("Working content");
    const chat = screen.getByLabelText("Assistant conversation");
    const desktopWidth = chat.style.width;
    fireEvent.change(editor, { target: { value: "Unsaved edit" } });
    fireEvent.change(draft, { target: { value: "Question in progress" } });

    width.mockReturnValue(390);
    act(() => state.resize(390));
    expect(chat.style.display).toBe("none");
    expect(chat.hasAttribute("inert")).toBe(true);
    expect(content.style.minWidth).toBe("0px");
    expect(screen.queryByRole("separator", { name: "Resize chat" })).toBeNull();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Chat" }));
      expect(chat.style.width).toBe("100%");
      expect(chat.hasAttribute("inert")).toBe(false);
      expect(content.style.display).toBe("none");
      expect(content.hasAttribute("inert")).toBe(true);
      fireEvent.click(screen.getByRole("link", { name: "Open document" }));
      expect(content.style.display).toBe("flex");
      expect(content.hasAttribute("inert")).toBe(false);
      expect(chat.style.display).toBe("none");
    }
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Content" }));
    expect(screen.getByLabelText("Unsaved field")).toBe(editor);
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
    expect(editor.value).toBe("Unsaved edit");
    expect(draft.value).toBe("Question in progress");
    width.mockReturnValue(1000);
    act(() => state.resize(1000));
    expect(chat.style.width).toBe(desktopWidth);
    expect(content.style.display).toBe("flex");
    expect(state.unmount).not.toHaveBeenCalled();
  }, 10_000);

  it("reopens content after navigation, including a repeat selection of the same address", () => {
    render(
      <>
        <Link to="/document">Open document</Link>
        <WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />
      </>,
    );
    const editor = screen.getByLabelText("Unsaved field");
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Collapse content" }));
      expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(true);
      expect(screen.getByLabelText("Working content").style.display).toBe("none");
      fireEvent.click(screen.getByRole("link", { name: "Open document" }));
      expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(false);
      expect(screen.getByLabelText("Unsaved field")).toBe(editor);
    }
    expect(state.unmount).not.toHaveBeenCalled();
  });

  it("expands chat into content space without losing the editor or preferred width", () => {
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    const editor = screen.getByLabelText("Unsaved field") as HTMLInputElement;
    fireEvent.change(editor, { target: { value: "Unsaved content" } });
    const initial = screen.getByLabelText("Assistant conversation").style.width;
    const collapseContent = screen.getByRole("button", { name: "Collapse content" });
    expect(screen.getByLabelText("Working content").contains(collapseContent)).toBe(true);
    expect(screen.getByLabelText("Assistant conversation").contains(collapseContent)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Collapse chat" }));
    fireEvent.click(collapseContent);
    expect(screen.queryByRole("button", { name: "Expand chat" })).toBeNull();
    expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(true);
    expect(screen.queryByRole("separator", { name: "Resize chat" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand content" }));
    expect(screen.getByLabelText("Unsaved field")).toBe(editor);
    expect(editor.value).toBe("Unsaved content");
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(initial);
    expect(state.unmount).not.toHaveBeenCalled();
  });

  it("resizes without remounting chat, persists the width, and resets to default", () => {
    const view = render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    const draft = screen.getByLabelText("Chat draft");
    const divider = screen.getByRole("separator", { name: "Resize chat" });
    const initial = Number(divider.getAttribute("aria-valuenow"));
    fireEvent.keyDown(divider, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial + 40}px`);
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
    view.unmount();
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial + 40}px`);
    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize chat" }));
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial}px`);
  });

  it("shows the current context instead of history in an empty side panel", () => {
    state.empty = true;
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "What would you like to get done?" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chat history" })).toBeNull();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
    expect(screen.getAllByRole("button", { name: "New chat" })).toHaveLength(1);
    const buttons = screen.getAllByRole("button", { name: "New chat" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole("heading", { name: "What would you like to get done?" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chat history" })).toBeNull();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
  });

  it("shows separate recent and pinned chats below the home composer", () => {
    state.empty = true;
    state.groups = [
      {
        label: "Chats",
        items: [],
        meta: {
          type: "recent-chats",
          allConversations: [
            ...["Newest", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"].map(
              (label) => ({
                label,
                to: `/chat/${label.toLowerCase()}`,
                icon: MessageSquare,
                meta:
                  label === "Second"
                    ? { pinned: true, previewSpaceName: "Finance" }
                    : { previewSpaceName: "Operations" },
              }),
            ),
          ],
        },
      },
    ];
    render(<WorkbenchPreview defaultSideChatCollapsed={false} chatOnly page={<Editor />} />);
    const recent = screen.getByRole("region", { name: "Recent" });
    const pinned = screen.getByRole("region", { name: "Pinned" });
    expect(within(recent).getByRole("link", { name: /Newest/ })).toBeTruthy();
    expect(within(recent).getByRole("link", { name: /Third/ })).toBeTruthy();
    expect(within(recent).getByRole("link", { name: /Fourth/ })).toBeTruthy();
    expect(within(recent).getByRole("link", { name: /Fifth/ })).toBeTruthy();
    expect(within(recent).getByRole("link", { name: /Sixth/ })).toBeTruthy();
    expect(within(pinned).getByRole("link", { name: /Second/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Seventh/ })).toBeNull();
    expect(within(recent).getAllByText("Last in Operations")).toHaveLength(5);
    expect(within(pinned).getByText("Last in Finance")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your chats" }).parentElement?.className).toContain(
      "justify-center",
    );
    expect(screen.getAllByRole("button", { name: "Chat history" })).toHaveLength(1);
    expect(
      screen
        .getByLabelText("Chat draft")
        .compareDocumentPosition(screen.getByRole("heading", { name: "Your chats" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const viewAll = screen.getByRole("button", { name: "View all conversations" });
    expect(viewAll.parentElement?.className).toContain("justify-center");
    fireEvent.click(viewAll);
    expect(screen.getByRole("heading", { name: "Chat history" })).toBeTruthy();
  });

  it("does not show contextual starter skeletons on cold global chat home", () => {
    state.empty = true;
    state.navLoading = true;
    actualNavStore.setState({ navLoading: true });
    const starters = vi.fn(() => <div>Contextual loading rows</div>);
    registerChatSlots({ homeStarters: starters });
    render(<WorkbenchPreview defaultSideChatCollapsed={false} chatOnly page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "What would you like to get done?" })).toBeTruthy();
    expect(screen.queryByText("Contextual loading rows")).toBeNull();
    expect(starters).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Loading recent chats" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading pinned chats" })).toBeTruthy();
  });

  it("keeps the recent and pinned groups available when only pinned chats exist", () => {
    state.empty = true;
    state.groups = [
      {
        label: "Pinned",
        items: [],
        meta: {
          type: "recent-chats",
          allConversations: [
            {
              label: "Saved review",
              to: "/chat/saved",
              icon: MessageSquare,
              meta: { pinned: true },
            },
          ],
        },
      },
    ];
    render(<WorkbenchPreview defaultSideChatCollapsed={false} chatOnly page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "Your chats" })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Recent" })).getByText(
        "Your latest chats will appear here.",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Pinned" })).getByRole("link", {
        name: /Saved review/,
      }),
    ).toBeTruthy();
  });

  it("shows workspace recents at a focused root that only exposes root metadata", () => {
    state.empty = true;
    state.navContext.meta = { spacesRootId: "w1" };
    const recent = {
      label: "Recent chats",
      items: [],
      meta: {
        type: "recent-chats",
        workspaceId: "w1",
        workspaceConversations: [
          {
            label: "Workspace review",
            to: "/chat/review",
            icon: MessageSquare,
            meta: { previewEntityId: "task" },
          },
        ],
      },
    };
    state.groups = [
      {
        label: "Workspaces",
        items: [
          {
            label: "Workspace one",
            to: "/",
            icon: Folder,
            meta: { spacesRootId: "w1" },
          },
        ],
        meta: { type: "spaces-workspaces", exclusiveRootId: "w1" },
      },
      recent,
    ];
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(screen.getByRole("link", { name: /Workspace review/ })).toBeTruthy();
  });

  it("uses the current route for contextual recents while nav context catches up", () => {
    state.empty = true;
    state.navContext.meta = { spacesEntityId: "w1", spacesRootId: "w1" };
    state.groups = [
      {
        label: "Workspaces",
        items: [
          {
            label: "Workspace one",
            to: "/",
            icon: Folder,
            meta: { spacesRootId: "w1" },
            children: [
              {
                label: "Task",
                to: "/task",
                icon: Folder,
                meta: { spacesEntityId: "task", spacesRootId: "w1" },
              },
            ],
          },
        ],
        meta: { type: "spaces-workspaces", exclusiveRootId: "w1" },
      },
      {
        label: "Recent chats",
        items: [],
        meta: {
          type: "recent-chats",
          workspaceId: "w1",
          workspaceConversations: [
            {
              label: "Workspace review",
              to: "/chat/workspace",
              icon: MessageSquare,
              meta: { previewEntityId: "w1" },
            },
            {
              label: "Task review",
              to: "/chat/task",
              icon: MessageSquare,
              meta: { previewEntityId: "task" },
            },
          ],
        },
      },
    ];
    render(
      <>
        <Link to="/task">Open task</Link>
        <WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />
      </>,
    );
    expect(screen.getByRole("link", { name: /Workspace review/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Open task" }));
    expect(screen.queryByRole("link", { name: /Workspace review/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Task review/ })).toBeTruthy();
  });

  it("keeps entity recents when only the nav route has a trailing slash", () => {
    state.empty = true;
    state.groups = [
      {
        label: "Workspaces",
        items: [
          {
            label: "Workspace one",
            to: "/workspace",
            icon: Folder,
            meta: { spacesRootId: "w1" },
            children: [
              {
                label: "Task",
                to: "/workspace/task/",
                icon: Folder,
                meta: { spacesEntityId: "task", spacesRootId: "w1" },
              },
            ],
          },
        ],
        meta: { type: "spaces-workspaces", exclusiveRootId: "w1" },
      },
      {
        label: "Recent chats",
        items: [],
        meta: {
          type: "recent-chats",
          workspaceId: "w1",
          workspaceConversations: [
            {
              label: "Task review",
              to: "/chat/task",
              icon: MessageSquare,
              meta: { previewEntityId: "task" },
            },
          ],
        },
      },
    ];
    renderUI(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/workspace/task"]}>{children}</MemoryRouter>
      ),
    });
    expect(screen.getByRole("link", { name: /Task review/ })).toBeTruthy();
  });

  it("keeps a fresh composer after reset and opens history explicitly", () => {
    state.empty = true;
    const view = render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    fireEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]);
    view.unmount();
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "What would you like to get done?" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Chat history" })).toBeNull();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
    fireEvent.click(screen.getAllByRole("button", { name: "Chat history" })[1]);
    expect(screen.getByRole("heading", { name: "Chat history" })).toBeTruthy();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
  });

  it("keeps the visible history shortcut when content is collapsed", () => {
    state.empty = true;
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    const draft = screen.getByLabelText("Chat draft") as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: "Draft question" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse content" }));
    expect(screen.getByRole("heading", { name: "What would you like to get done?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
    expect(screen.getByRole("region", { name: "Chat history" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
    expect(draft.value).toBe("Draft question");
  });

  it("filters only the sidebar presentation in a workspace and restores global navigation outside it", () => {
    const child = { label: "Documents", to: "/w1/docs", icon: Folder };
    const root = {
      label: "Workspace one",
      icon: Folder,
      to: "/w1",
      children: [child],
      meta: { spacesRootId: "w1" },
    };
    const workspace = {
      label: "Workspaces",
      focusOn: "/w1",
      items: [root],
      meta: { type: "spaces-workspaces", exclusiveRootId: "w1" },
    };
    const recent = {
      label: "Recent chats",
      items: [],
      meta: { type: "recent-chats", workspaceId: "w1" },
    };
    const activity = {
      label: "Activity",
      items: [{ label: "Activity", to: "/tasks?workspace=w1", icon: Folder }],
      meta: { showInWorkspaceNavigation: true },
    };
    state.groups = [activity, workspace, recent];
    const { rerender } = render(
      <WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />,
    );
    expect(state.sidebar.mock.lastCall?.[0].groups).toEqual([
      expect.objectContaining({ ...activity, priority: 1100 }),
      expect.objectContaining({
        label: "All spaces",
        items: [{ ...root, children: undefined, childrenLoading: false }],
      }),
      expect.objectContaining({ label: "Content", items: [child] }),
    ]);
    expect(state.sidebar.mock.lastCall?.[0].hideNewConversation).toBe(true);
    expect(root.children).toEqual([child]);
    expect(state.groups).toEqual([activity, workspace, recent]);
    expect(state.sidebar.mock.lastCall?.[0].onNewConversation).toBeTypeOf("function");
    state.groups = [
      activity,
      { ...workspace, items: [{ ...root, children: [], childrenLoading: true }] },
      recent,
    ];
    rerender(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(state.sidebar.mock.lastCall?.[0].groups).toEqual([
      expect.objectContaining({ label: "Activity" }),
      expect.objectContaining({
        label: "All spaces",
        items: [expect.objectContaining({ childrenLoading: false })],
      }),
      expect.objectContaining({ label: "Content", items: [], loading: true }),
    ]);

    state.groups = [
      activity,
      { ...workspace, meta: { type: "spaces-workspaces" } },
      recent,
      { label: "Pinned", items: [], meta: { type: "pinned-chats" } },
    ];
    rerender(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    expect(state.sidebar.mock.lastCall?.[0].groups).toHaveLength(2);
    expect(state.sidebar.mock.lastCall?.[0].collapsedGroupsOnly).toBe(true);
    expect(state.sidebar.mock.lastCall?.[0].hideNewConversation).toBe(true);
    expect(state.sidebar.mock.lastCall?.[0].hideFooterActions).toBe(false);
  });

  it("preserves unsaved fields and chat drafts when collapsed to a rail", () => {
    render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
    const editor = screen.getByLabelText("Unsaved field") as HTMLInputElement;
    const draft = screen.getByLabelText("Chat draft") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "Unsaved edit" } });
    fireEvent.change(draft, { target: { value: "Question in progress" } });
    fireEvent.click(screen.getByRole("button", { name: "Collapse chat" }));
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe("44px");
    expect(draft.parentElement?.style.display).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Expand chat" }));
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
    expect(draft.value).toBe("Question in progress");
    expect(screen.getByLabelText("Unsaved field")).toBe(editor);
    expect(editor.value).toBe("Unsaved edit");
    expect(screen.getByLabelText("Working content").style.transform).toBe("translateZ(0)");
    expect(
      screen
        .getByLabelText("Assistant conversation")
        .compareDocumentPosition(screen.getByLabelText("Working content")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(state.unmount).not.toHaveBeenCalled();
  });
});

function render(ui: ReactNode) {
  return renderUI(ui, { wrapper: MemoryRouter });
}

it("shows ongoing work in the collapsed rail and clears it when the run ends", () => {
  state.running = true;
  const view = render(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
  fireEvent.click(screen.getByRole("button", { name: "Collapse chat" }));
  expect(screen.getByRole("button", { name: "AI is working — expand chat" })).toBeTruthy();
  state.running = false;
  view.rerender(<WorkbenchPreview defaultSideChatCollapsed={false} page={<Editor />} />);
  expect(screen.queryByRole("button", { name: "AI is working — expand chat" })).toBeNull();
  expect(screen.getByRole("button", { name: "Expand chat" })).toBeTruthy();
});
