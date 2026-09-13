import { Link, MemoryRouter } from "react-router";
import { Folder } from "lucide-react";
import type { NavGroup } from "@iloveagents/foundry-web-ui";
import { type ReactNode, useEffect } from "react";
import { act, cleanup, fireEvent, render as renderUI, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  resize: (_width: number) => {},
  unmount: vi.fn(),
  groups: [] as NavGroup[],
  empty: false,
  sidebar: vi.fn(),
}));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (select: (s: unknown) => unknown) =>
    select({
      thread: { messages: state.empty ? [] : [{}], isRunning: false, isLoading: false },
      composer: { text: "" },
    }),
}));
vi.mock("@iloveagents/foundry-web-ui", () => ({
  Sidebar: (props: unknown) => {
    state.sidebar(props);
    return null;
  },
  useAppStore: (select: (s: unknown) => unknown) =>
    select({ currentPage: "/document", navContext: { label: "Document" } }),
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
  useNavStore: (select: (s: unknown) => unknown) => select({ config: state.groups }),
  useNewConversation: () => vi.fn(),
  ChatContent: ({ emptyState }: { emptyState: ReactNode }) => (
    <>
      {" "}
      {state.empty && emptyState}
      <textarea aria-label="Chat draft" />
    </>
  ),
  ToolPanelLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
  useToolPanelStore: (select: (s: unknown) => unknown) =>
    select({ isOpen: false, closePanel: vi.fn() }),
  useChatBubbleStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ isOpen: false, isExpanded: false }),
    { getState: () => ({ close: vi.fn() }) },
  ),
}));
import { isWorkbenchPreviewEnabled, WorkbenchPreview } from "../workbench-preview.tsx";

function Editor() {
  useEffect(() => () => state.unmount(), []);
  return <input aria-label="Unsaved field" defaultValue="Original" />;
}

beforeEach(() => {
  state.unmount.mockClear();
  state.sidebar.mockClear();
  state.groups = [];
  state.empty = false;
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
  it("shows one full-width pane in narrow containers, preserving drafts and reopening content on navigation", () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    render(
      <>
        <Link to="/document">Open document</Link>
        <WorkbenchPreview page={<Editor />} />
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
  });

  it("reopens content after navigation, including a repeat selection of the same address", () => {
    render(
      <>
        <Link to="/document">Open document</Link>
        <WorkbenchPreview page={<Editor />} />
      </>,
    );
    const editor = screen.getByLabelText("Unsaved field");
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Collapse content" }));
      expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(true);
      fireEvent.click(screen.getByRole("link", { name: "Open document" }));
      expect(screen.getByLabelText("Working content").hasAttribute("inert")).toBe(false);
      expect(screen.getByLabelText("Unsaved field")).toBe(editor);
    }
    expect(state.unmount).not.toHaveBeenCalled();
  });

  it("expands chat into content space without losing the editor or preferred width", () => {
    render(<WorkbenchPreview page={<Editor />} />);
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
    const view = render(<WorkbenchPreview page={<Editor />} />);
    const draft = screen.getByLabelText("Chat draft");
    const divider = screen.getByRole("separator", { name: "Resize chat" });
    const initial = Number(divider.getAttribute("aria-valuenow"));
    fireEvent.keyDown(divider, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial + 40}px`);
    expect(screen.getByLabelText("Chat draft")).toBe(draft);
    view.unmount();
    render(<WorkbenchPreview page={<Editor />} />);
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial + 40}px`);
    fireEvent.doubleClick(screen.getByRole("separator", { name: "Resize chat" }));
    expect(screen.getByLabelText("Assistant conversation").style.width).toBe(`${initial}px`);
  });

  it("shows recent chats beside the composer in an empty side panel", () => {
    state.empty = true;
    render(<WorkbenchPreview page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "Recent chats" })).toBeTruthy();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
    expect(screen.getAllByRole("button", { name: "New chat" })).toHaveLength(1);
    const buttons = screen.getAllByRole("button", { name: "New chat" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole("heading", { name: "Recent chats" })).toBeTruthy();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
  });

  it("keeps history and the composer after reset", () => {
    state.empty = true;
    const view = render(<WorkbenchPreview page={<Editor />} />);
    fireEvent.click(screen.getAllByRole("button", { name: "New chat" })[0]);
    view.unmount();
    render(<WorkbenchPreview page={<Editor />} />);
    expect(screen.getByRole("heading", { name: "Recent chats" })).toBeTruthy();
    expect(screen.getByLabelText("Chat draft").parentElement?.style.display).toBe("flex");
    fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
    expect(screen.getByRole("heading", { name: "Recent chats" })).toBeTruthy();
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
      label: "Recent conversations",
      items: [],
      meta: { type: "recent-chats", workspaceId: "w1" },
    };
    const activity = { label: "Activity", items: [] };
    state.groups = [activity, workspace, recent];
    const { rerender } = render(<WorkbenchPreview page={<Editor />} />);
    expect(state.sidebar.mock.lastCall?.[0].groups).toEqual([
      expect.objectContaining({ label: "Spaces", items: [{ ...root, children: undefined }] }),
      expect.objectContaining({ label: "Content", items: [child] }),
    ]);
    expect(state.sidebar.mock.lastCall?.[0].hideNewConversation).toBe(true);
    expect(root.children).toEqual([child]);
    expect(state.groups).toEqual([activity, workspace, recent]);
    expect(state.sidebar.mock.lastCall?.[0].onNewConversation).toBeTypeOf("function");
    state.groups = [activity, { ...workspace, meta: { type: "spaces-workspaces" } }];
    rerender(<WorkbenchPreview page={<Editor />} />);
    expect(state.sidebar.mock.lastCall?.[0].groups).toHaveLength(3);
    expect(state.sidebar.mock.lastCall?.[0].collapsedGroupsOnly).toBe(true);
    expect(state.sidebar.mock.lastCall?.[0].hideNewConversation).toBe(false);
    expect(state.sidebar.mock.lastCall?.[0].hideFooterActions).toBe(false);
  });

  it("is opt-in, survives local navigation, restores classic, and cannot enable in production", () => {
    vi.stubEnv("DEV", true);
    expect(isWorkbenchPreviewEnabled()).toBe(false);
    window.history.replaceState({}, "", "/?ux=workbench");
    expect(isWorkbenchPreviewEnabled()).toBe(true);
    window.history.replaceState({}, "", "/document");
    expect(isWorkbenchPreviewEnabled()).toBe(true);
    window.history.replaceState({}, "", "/?ux=classic");
    expect(isWorkbenchPreviewEnabled()).toBe(false);
    vi.stubEnv("DEV", false);
    window.history.replaceState({}, "", "/?ux=workbench");
    expect(isWorkbenchPreviewEnabled()).toBe(false);
  });

  it("preserves unsaved fields and chat drafts when collapsed to a rail", () => {
    render(<WorkbenchPreview page={<Editor />} />);
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
