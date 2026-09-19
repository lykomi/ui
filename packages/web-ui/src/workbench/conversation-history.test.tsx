import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MessageSquare } from "lucide-react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ConversationHistory } from "./conversation-history.tsx";
import {
  beginChatRun,
  updateChatRun,
  disposeChatRuns,
  removeChatRun,
} from "../lib/chat-runs-store.ts";
import type { NavGroup, NavItem } from "../lib/nav-config.ts";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  disposeChatRuns();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  disposeChatRuns();
  vi.restoreAllMocks();
});
const item = (id: string, entity: string): NavItem => ({
  to: `/chat/${id}`,
  label: `Saved ${id}`,
  icon: MessageSquare,
  meta: { previewEntityId: entity },
});
const groups: NavGroup[] = [
  {
    label: "Recent",
    items: [item("saved", "entity")],
    meta: {
      type: "recent-chats",
      workspaceId: "workspace",
      allConversations: [item("saved", "entity"), item("foreign", "elsewhere")],
      workspaceConversations: [item("saved", "entity")],
    },
  },
];
const begin = (id: string, workspace: string, entity = "entity") =>
  beginChatRun({
    threadId: id,
    title: `Live ${id}`,
    stop: vi.fn(),
    contextMeta: { spacesRootId: workspace, spacesEntityId: entity },
  });
async function render(compact = true, rootContext = false) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ConversationHistory
          groups={groups}
          workspaceId="workspace"
          entityId="entity"
          compact={compact}
          rootContext={rootContext}
          onClose={vi.fn()}
          onViewAll={vi.fn()}
        />
      </MemoryRouter>,
    );
  });
}
it("shows new running chats immediately in recents and history with exact entity/workspace isolation", async () => {
  begin("current", "workspace");
  begin("sibling", "workspace", "sibling");
  begin("other", "other-workspace");
  updateChatRun("current", "waiting");
  await render();
  expect(host.textContent).toContain("Live current");
  expect(host.textContent).toContain("Waiting for you");
  expect(host.textContent).not.toContain("Live sibling");
  expect(host.textContent).not.toContain("Live other");
  expect(host.querySelector('a[href="/chat/current"]')).not.toBeNull();
  await render(true, true);
  expect(host.textContent).toContain("Live sibling");
  expect(host.textContent).not.toContain("Live other");
  await render(false);
  expect(host.textContent).toContain("Live sibling");
  expect(host.querySelectorAll('section[aria-label="Running"] a')).toHaveLength(2);
});
it("keeps the persisted title and location after a run finishes, without duplicate rows", async () => {
  begin("saved", "workspace");
  await render();
  expect(host.querySelectorAll('a[href="/chat/saved"]')).toHaveLength(1);
  expect(host.textContent).toContain("Saved saved");
  await act(async () => updateChatRun("saved", "completed"));
  expect(host.textContent).not.toContain("Running");
  expect(host.textContent).toContain("Saved saved");
});

it("keeps new completions visible but removes successfully deleted chats", async () => {
  begin("deleted", "workspace");
  updateChatRun("deleted", "completed");
  await render(false);
  expect(host.querySelector('a[href="/chat/deleted"]')).not.toBeNull();
  await act(async () => removeChatRun("deleted"));
  expect(host.querySelector('a[href="/chat/deleted"]')).toBeNull();
  expect(host.textContent).toContain("Saved saved");
});

it("keeps active and just-finished chats visible among the five home recents", async () => {
  const previousUpdate = new Date(Date.now() - 20_000).toISOString();
  const homeItems = ["one", "two", "three", "four"].map((id) => ({
    ...item(id, "entity"),
    meta: { updatedAt: previousUpdate },
  }));
  const renderHome = async (items: NavItem[]) => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ConversationHistory
            groups={[
              {
                label: "Recent",
                items,
                meta: { type: "recent-chats", allConversations: items },
              },
            ]}
            workspaceId={undefined}
            home
            onClose={vi.fn()}
          />
        </MemoryRouter>,
      );
    });
  };
  begin("four", "workspace");
  await renderHome(homeItems);
  const recents = host.querySelector('section[aria-label="Recent"]');
  expect(recents?.querySelectorAll("a")).toHaveLength(4);
  expect(recents?.querySelector('a[href="/chat/four"]')).not.toBeNull();
  expect(recents?.querySelector('a[href="/chat/three"]')).not.toBeNull();
  await act(async () => updateChatRun("four", "completed"));
  expect(recents?.querySelector('a[href="/chat/four"]')).not.toBeNull();
  const newerItems = ["new-a", "new-b", "new-c", "new-d", "new-e"].map((id, index) => ({
    ...item(id, "entity"),
    meta: { updatedAt: new Date(Date.now() + (3 - index) * 1_000).toISOString() },
  }));
  await renderHome([...newerItems, ...homeItems]);
  expect(recents?.querySelector('a[href="/chat/one"]')).toBeNull();
  expect(recents?.querySelectorAll("a")).toHaveLength(5);
});

it("shows the last workspace on home recent and pinned rows", async () => {
  const recent = {
    ...item("recent", "entity"),
    meta: { previewSpaceName: "Sales" },
  };
  const pinned = {
    ...item("pinned", "entity"),
    meta: { pinned: true, previewSpaceName: "Legal" },
  };
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ConversationHistory
          groups={[
            {
              label: "Recent",
              items: [recent, pinned],
              meta: { type: "recent-chats", allConversations: [recent, pinned] },
            },
          ]}
          workspaceId={undefined}
          home
          onClose={vi.fn()}
          onViewAll={vi.fn()}
        />
      </MemoryRouter>,
    );
  });
  expect(host.textContent).toContain("Last in Sales");
  expect(host.textContent).toContain("Last in Legal");
  expect(
    [...host.querySelectorAll("button")].some((button) =>
      button.textContent?.includes("View all conversations"),
    ),
  ).toBe(true);
});
