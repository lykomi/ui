import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, MessageSquare, SquarePen } from "lucide-react";
import type { NavGroup, NavItem } from "@iloveagents/foundry-web-ui";

/** History is a view of existing navigation targets, never a second chat runtime. */
export function ConversationHistory({
  groups,
  workspaceId,
  onClose,
  onNewChat,
  showBack = true,
}: {
  groups: NavGroup[];
  workspaceId: unknown;
  onClose: () => void;
  onNewChat?: () => void;
  showBack?: boolean;
}) {
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const scoped = groups.find(
    (g) => g.meta?.type === "recent-chats" && g.meta?.workspaceId === workspaceId,
  );
  const allItems =
    (scoped?.meta?.allConversations as NavItem[] | undefined) ??
    groups
      .filter((g) => g.meta?.type === "recent-chats" || g.meta?.type === "pinned-chats")
      .flatMap((g) => g.items);
  const items = (
    all || !workspaceId
      ? allItems
      : ((scoped?.meta?.workspaceConversations as NavItem[] | undefined) ?? scoped?.items ?? [])
  )
    .filter((item) => item.meta?.type !== "show-all-chats")
    .filter((item) => item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <section aria-label="Chat history" className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {showBack && (
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to chat
        </button>
      )}
      <h2 className="mb-3 mt-2 text-base font-semibold">Recent chats</h2>
      {Boolean(workspaceId) && (
        <select
          aria-label="Chat scope"
          value={all ? "all" : "workspace"}
          onChange={(event) => setAll(event.target.value === "all")}
          className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="workspace">This workspace</option>
          <option value="all">All workspaces</option>
        </select>
      )}
      <input
        aria-label="Search chats"
        placeholder="Search chats"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) =>
          item.disabled ? (
            <p key={item.to} className="py-3 text-sm text-muted-foreground">
              {item.label}
            </p>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg px-2 py-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              <MessageSquare size={15} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{item.label}</span>
            </Link>
          ),
        )}
        {items.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            {search ? "No matching chats" : "No chats yet"}
          </p>
        )}
      </div>
      {onNewChat && (
        <button
          onClick={onNewChat}
          className="mt-4 inline-flex shrink-0 self-start items-center justify-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <SquarePen size={16} /> New chat
        </button>
      )}
    </section>
  );
}
