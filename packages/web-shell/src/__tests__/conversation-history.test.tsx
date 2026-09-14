import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { MessageSquare } from "lucide-react";
import { ConversationHistory } from "@iloveagents/foundry-web-ui/workbench";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
});
afterEach(cleanup);
it("starts in the current workspace with entity sublines and allows all conversations", () => {
  const local = {
    label: "Contract review",
    to: "/chat/local",
    icon: MessageSquare,
    meta: { previewSpaceName: "Project", previewEntityName: "First task" },
  };
  const other = { label: "Across workspaces", to: "/chat/other", icon: MessageSquare };
  const close = vi.fn();
  render(
    <MemoryRouter>
      <ConversationHistory
        workspaceId="w1"
        onClose={close}
        groups={[
          {
            label: "Recent conversations",
            items: [local],
            meta: { type: "recent-chats", workspaceId: "w1", allConversations: [local, other] },
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("History filter").textContent).toBe("Last used in this workspace");
  expect(screen.getByText("Last at First task")).toBeTruthy();
  expect(screen.queryByText(other.label)).toBeNull();
  fireEvent.keyDown(screen.getByLabelText("History filter"), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "All conversations" }));
  expect(screen.getByText("Last in Project")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: `${other.label} Last outside a workspace` })
      .getAttribute("href"),
  ).toBe(other.to);
  fireEvent.change(screen.getByLabelText("Search chats"), { target: { value: "Across" } });
  expect(screen.queryByText(local.label)).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: `${other.label} Last outside a workspace` }));
  expect(close).toHaveBeenCalledOnce();
});

it("resets the filter on workspace changes and does not invent an entity label", () => {
  const view = render(
    <MemoryRouter>
      <ConversationHistory workspaceId={undefined} groups={[]} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.queryByLabelText("History filter")).toBeNull();
  const groups = [
    {
      label: "Chats",
      items: [{ label: "Review", to: "/chat/one", icon: MessageSquare }],
      meta: { type: "recent-chats", workspaceId: "w1" },
    },
  ];
  view.rerender(
    <MemoryRouter>
      <ConversationHistory workspaceId="w1" groups={groups} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("History filter").textContent).toBe("Last used in this workspace");
  expect(screen.getByText("Last in this workspace")).toBeTruthy();
  fireEvent.keyDown(screen.getByLabelText("History filter"), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "All conversations" }));
  view.rerender(
    <MemoryRouter>
      <ConversationHistory workspaceId="w2" groups={[]} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("History filter").textContent).toBe("Last used in this workspace");
});

it("shows workspace recents at a root and only exact entity recents elsewhere", () => {
  const root = {
    label: "Workspace planning",
    to: "/chat/root",
    icon: MessageSquare,
    meta: { previewEntityId: "workspace", previewEntityName: "Workspace" },
  };
  const task = {
    label: "Task review",
    to: "/chat/task",
    icon: MessageSquare,
    meta: { previewEntityId: "task", previewEntityName: "Task" },
  };
  const groups = [
    {
      label: "Recent conversations",
      items: [root, task],
      meta: {
        type: "recent-chats",
        workspaceId: "workspace",
        workspaceConversations: [root, task],
      },
    },
  ];
  const view = render(
    <MemoryRouter>
      <ConversationHistory
        compact
        rootContext
        entityId="workspace"
        workspaceId="workspace"
        groups={groups}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Workspace planning")).toBeTruthy();
  expect(screen.getByText("Task review")).toBeTruthy();

  view.rerender(
    <MemoryRouter>
      <ConversationHistory
        compact
        entityId="task"
        workspaceId="workspace"
        groups={groups}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByText("Workspace planning")).toBeNull();
  expect(screen.getByText("Task review")).toBeTruthy();
});

it("shows only the conversations action when an entity has no exact recent chat", () => {
  const viewAll = vi.fn();
  render(
    <MemoryRouter>
      <ConversationHistory
        compact
        entityId="other-task"
        workspaceId="workspace"
        groups={[
          {
            label: "Recent conversations",
            items: [],
            meta: {
              type: "recent-chats",
              workspaceId: "workspace",
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
        ]}
        onClose={() => {}}
        onViewAll={viewAll}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByText("No chats yet")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Conversation history" }));
  expect(viewAll).toHaveBeenCalledOnce();
});

it("does not leak workspace recents when the current entity metadata is unavailable", () => {
  render(
    <MemoryRouter>
      <ConversationHistory
        compact
        workspaceId="workspace"
        groups={[
          {
            label: "Recent conversations",
            items: [],
            meta: {
              type: "recent-chats",
              workspaceId: "workspace",
              workspaceConversations: [
                {
                  label: "Private task review",
                  to: "/chat/task",
                  icon: MessageSquare,
                  meta: { previewEntityId: "task" },
                },
              ],
            },
          },
        ]}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByText("Private task review")).toBeNull();
  expect(screen.getByRole("button", { name: "Conversation history" })).toBeTruthy();
});

it("separates pinned chats from recents without duplicating entries", () => {
  render(
    <MemoryRouter>
      <ConversationHistory
        workspaceId={undefined}
        onClose={() => {}}
        groups={[
          {
            label: "Chats",
            meta: { type: "recent-chats" },
            items: [
              { label: "Recent discussion", to: "/chat/recent", icon: MessageSquare },
              {
                label: "Saved discussion",
                to: "/chat/pinned",
                icon: MessageSquare,
                meta: { pinned: true },
              },
            ],
          },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Pinned" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Recent chats" })).toBeTruthy();
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Saved discussion Last outside a workspace",
    "Recent discussion Last outside a workspace",
  ]);
});

it("returns to the current chat without attempting to resume a history item", () => {
  const close = vi.fn();
  const resume = vi.fn();
  window.addEventListener("preview:resume-chat", resume);
  render(
    <MemoryRouter>
      <ConversationHistory workspaceId="w1" groups={[]} onClose={close} showBack />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
  expect(close).toHaveBeenCalledOnce();
  expect(resume).not.toHaveBeenCalled();
  window.removeEventListener("preview:resume-chat", resume);
});

it.each([undefined, "Cannot load conversation"])(
  "handles synchronous history completion (%s) without getting stuck",
  (error) => {
    const close = vi.fn();
    const resume = (event: Event) => {
      event.preventDefault();
      (event as CustomEvent).detail.complete(error);
    };
    window.addEventListener("preview:resume-chat", resume);
    try {
      render(
        <MemoryRouter>
          <ConversationHistory
            workspaceId={undefined}
            onClose={close}
            groups={[
              {
                label: "Chats",
                meta: { type: "recent-chats" },
                items: [{ label: "Review", to: "/chat/review", icon: MessageSquare }],
              },
            ]}
          />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole("link", { name: "Review Last outside a workspace" }));
      expect(screen.queryByLabelText("Opening chat")).toBeNull();
      if (error) {
        expect(screen.getByRole("alert").textContent).toBe(error);
        expect(close).not.toHaveBeenCalled();
      } else expect(close).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("preview:resume-chat", resume);
    }
  },
);
