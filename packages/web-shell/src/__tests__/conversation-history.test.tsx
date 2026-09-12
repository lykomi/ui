import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { MessageSquare } from "lucide-react";
import { ConversationHistory } from "../preview/conversation-history.tsx";

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
