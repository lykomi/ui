import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MessageSquare } from "lucide-react";
import { ConversationHistory } from "../workbench/conversation-history.tsx";
import { WelcomeIntro } from "../workbench/welcome-intro.tsx";
import { registerChatSlots } from "../components/chat-slots.tsx";
import { useNavStore } from "../lib/nav-store.ts";
import type { NavGroup } from "../lib/nav-config.ts";
vi.mock("../index.ts", async () => ({
  ...(await import("../ui/dropdown-menu.tsx")),
  ...(await import("../lib/nav-store.ts")),
}));
let host: HTMLElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  registerChatSlots({ homeStarters: null });
  useNavStore.setState({ navLoading: false });
  vi.unstubAllGlobals();
});
const render = async (node: ReactNode) => {
  await act(async () => root.render(node));
};
it("does not mount contextual starter loaders above the global home create action", async () => {
  const starters = vi.fn(() => <div>Context skeleton</div>);
  registerChatSlots({ homeStarters: starters });
  useNavStore.setState({ navLoading: true });
  await render(<WelcomeIntro navGroups={[]} historyShortcut={null} />);
  expect(starters).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Context skeleton");
  await render(<WelcomeIntro contextual navGroups={[]} historyShortcut={null} />);
  expect(host.textContent).toContain("Context skeleton");
});
it("keeps both home cards while pending, populated, refreshing and empty", async () => {
  const tree = (groups: NavGroup[]) => (
    <MemoryRouter>
      <ConversationHistory
        home
        compact
        showBack={false}
        groups={groups}
        workspaceId={undefined}
        onClose={() => {}}
      />
    </MemoryRouter>
  );
  const loading: NavGroup[] = [
    { label: "Chats", items: [], loading: true, meta: { type: "recent-chats" } },
  ];
  await render(tree(loading));
  const recent = host.querySelector('[aria-label="Recent"]')!;
  const pinned = host.querySelector('[aria-label="Pinned"]')!;
  expect(recent.querySelector('[role="status"][aria-label="Loading recent chats"]')).not.toBeNull();
  expect(pinned.querySelector('[role="status"][aria-label="Loading pinned chats"]')).not.toBeNull();
  expect(host.textContent).toContain("Your chats");
  const ready: NavGroup[] = [
    {
      label: "Chats",
      meta: { type: "recent-chats" },
      items: [{ label: "Saved chat", to: "/chat/one", icon: MessageSquare }],
    },
  ];
  await render(tree(ready));
  expect(host.querySelector('[aria-label="Recent"]')).toBe(recent);
  expect(host.querySelector('[aria-label="Pinned"]')).toBe(pinned);
  expect(recent.querySelector("a")?.textContent).toContain("Saved chat");
  expect(pinned.textContent).toContain("Pin chats to keep them close.");
  await render(tree([{ ...ready[0], loading: true }]));
  expect(recent.querySelector('[role="status"]')).toBeNull();
  expect(recent.querySelector("a")?.textContent).toContain("Saved chat");
  await render(tree([{ ...ready[0], items: [] }]));
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  expect(host.querySelector('[aria-label="Recent"]')).toBe(recent);
  expect(recent.textContent).toContain("Your latest chats will appear here.");
});
it("shows initial home history placeholders before groups register", async () => {
  useNavStore.setState({ navLoading: true });
  await render(
    <MemoryRouter>
      <ConversationHistory
        home
        compact
        showBack={false}
        groups={[]}
        workspaceId={undefined}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );
  expect(host.querySelector('[aria-label="Loading recent chats"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Loading pinned chats"]')).not.toBeNull();
  await act(async () => useNavStore.setState({ navLoading: false }));
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
});
