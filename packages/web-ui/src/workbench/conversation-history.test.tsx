import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MessageSquare } from "lucide-react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ConversationHistory } from "./conversation-history.tsx";
import { beginChatRun, updateChatRun, disposeChatRuns } from "../lib/chat-runs-store.ts";
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
