import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { MessageSquare } from "lucide-react";
import { ConversationHistory } from "../preview/conversation-history.tsx";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
});
afterEach(cleanup);
it("starts scoped, exposes all-workspace history, and reuses saved chat links", () => {
  const local = { label: "Contract review", to: "/chat/local", icon: MessageSquare };
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
  expect(screen.queryByText(other.label)).toBeNull();
  fireEvent.change(screen.getByLabelText("Chat scope"), { target: { value: "all" } });
  expect(screen.getByRole("link", { name: other.label }).getAttribute("href")).toBe(other.to);
  fireEvent.change(screen.getByLabelText("Search chats"), { target: { value: "Across" } });
  expect(screen.queryByText(local.label)).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: other.label }));
  expect(close).toHaveBeenCalledOnce();
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
    "Saved discussion",
    "Recent discussion",
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
