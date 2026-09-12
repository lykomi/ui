import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@iloveagents/foundry-web-ui";
import { Fragment, useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowLeft, MessageSquare, MoreHorizontal, Pin, Loader2 } from "lucide-react";
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
  const [loadingTo, setLoadingTo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { pathname } = useLocation();
  const findCurrent = (items: NavItem[]): NavItem | undefined => {
    for (const item of items) {
      if (item.to === pathname) return item;
      const child = item.children && findCurrent(item.children);
      if (child) return child;
    }
  };
  const selected = findCurrent(groups.flatMap((group) => group.items));
  const overview = groups.some(
    (group) => group.meta?.type === "spaces-workspaces" && group.focusOn === pathname,
  );

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
    .filter((item) => item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => Number(Boolean(b.meta?.pinned)) - Number(Boolean(a.meta?.pinned)));
  const visibleItems = compact ? items.slice(0, 3) : items;
  const pinnedItems = visibleItems.filter((item) => item.meta?.pinned);
  const sections = pinnedItems.length
    ? [
        { label: "Pinned", items: pinnedItems },
        { label: "Recent chats", items: visibleItems.filter((item) => !item.meta?.pinned) },
      ]
    : [{ label: "", items: visibleItems }];
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
          {pinnedItems.length ? "Chats" : "Recent chats"}
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
      {loadError && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {loadError}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={Boolean(loadingTo)}>
        {sections
          .filter((section) => section.items.length)
          .map((section) => (
            <section
              key={section.label}
              aria-label={section.label || "Recent chats"}
              className="mb-4 last:mb-0"
            >
              {section.label && (
                <h3 className="px-2 py-2 text-xs font-medium text-muted-foreground">
                  {section.label}
                </h3>
              )}
              {section.items.map((item) =>
                item.disabled ? (
                  <p key={item.to} className="py-3 text-sm text-muted-foreground">
                    {item.label}
                  </p>
                ) : (
                  <div key={item.to} className="group flex items-center rounded-lg hover:bg-muted">
                    <Link
                      to={item.to}
                      state={
                        workspaceId
                          ? {
                              previewChatOrigin: {
                                path: pathname,
                                workspaceId,
                                overview,
                                label: selected?.label,
                              },
                            }
                          : undefined
                      }
                      onClick={(event) => {
                        if (loadingTo) {
                          event.preventDefault();
                          return;
                        }
                        if (
                          workspaceId &&
                          !event.ctrlKey &&
                          !event.metaKey &&
                          !event.shiftKey &&
                          !event.altKey
                        ) {
                          const resume = new CustomEvent("preview:resume-chat", {
                            cancelable: true,
                            detail: {
                              to: item.to,
                              origin: {
                                path: pathname,
                                workspaceId,
                                overview,
                                label: selected?.label,
                              },
                              complete: (error?: string) => {
                                setLoadingTo(null);
                                if (error) setLoadError(error);
                                else onClose();
                              },
                            },
                          });
                          if (!window.dispatchEvent(resume)) {
                            event.preventDefault();
                            setLoadError(null);
                            setLoadingTo(item.to);
                            return;
                          }
                        }
                        onClose();
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {loadingTo === item.to ? (
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-muted-foreground"
                          aria-label="Opening chat"
                        />
                      ) : item.meta?.pinned ? (
                        <Pin
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Pinned chat"
                        />
                      ) : (
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {all && typeof item.meta?.previewSpaceName === "string" && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.meta.previewSpaceName}
                          </span>
                        )}
                      </span>
                    </Link>
                    {Boolean(item.actions?.length) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${item.label}`}
                            className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-background"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.actions?.map((action) => (
                            <Fragment key={action.label}>
                              {action.separator && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                onSelect={() => {
                                  void action.handler();
                                }}
                                className={action.destructive ? "text-destructive" : undefined}
                              >
                                <action.icon className="mr-2 size-4" />
                                {action.label}
                              </DropdownMenuItem>
                            </Fragment>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ),
              )}
            </section>
          ))}
        {items.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            {search ? "No matching chats" : "No chats yet"}
          </p>
        )}
      </div>
    </section>
  );
}
