import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { NavGroup, NavItem } from "@iloveagents/foundry-web-ui";

/** History is a view of existing navigation targets, never a second chat runtime. */
export function ConversationHistory({
  groups,
  workspaceId,
  onClose,
  showBack = true,
  welcome = false,
  compact = false,
  onViewAll,
}: {
  groups: NavGroup[];
  workspaceId: unknown;
  onClose: () => void;
  showBack?: boolean;
  welcome?: boolean;
  compact?: boolean;
  onViewAll?: () => void;
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
      {welcome && (
        <div className="pb-6 pt-8">
          <h1 className="text-xl font-semibold">How can I help?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start something new or continue a recent chat.
          </p>
        </div>
      )}
      {showBack && (
        <button
          onClick={onClose}
          className="mb-4 flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to chat
        </button>
      )}
      <div className="mb-3 mt-2 flex items-center justify-between">
        <h2
          className={
            compact ? "text-xs font-medium text-muted-foreground" : "text-base font-semibold"
          }
        >
          Recent chats
        </h2>
        {compact && (
          <button
            onClick={onViewAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </button>
        )}
      </div>
      {Boolean(workspaceId) && (
        <select
          aria-label="Chat scope"
          value={all ? "all" : "workspace"}
          onChange={(event) => setAll(event.target.value === "all")}
          className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="workspace">This space</option>
          <option value="all">All spaces</option>
        </select>
      )}
      {!compact && (
        <input
          aria-label="Search chats"
          placeholder="Search chats"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {(compact ? items.slice(0, 3) : items).map((item) =>
          item.disabled ? (
            <p key={item.to} className="py-3 text-sm text-muted-foreground">
              {item.label}
            </p>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
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
    </section>
  );
}
