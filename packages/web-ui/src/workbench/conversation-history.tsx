import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu.tsx";
import { Button, Input } from "@iloveagents/foundry-web-primitives";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Loader2,
  ChevronDown,
  Check,
  MessagesSquare,
  PauseCircle,
  Copy,
} from "lucide-react";
import type { NavGroup, NavItem } from "../lib/nav-config.ts";

import { useChatRuns, isChatRunActive } from "../lib/chat-runs-store.ts";

/** History is a view of existing navigation targets, never a second chat runtime. */
export function ConversationHistory({
  groups,
  workspaceId,
  onClose,
  showBack = true,
  welcome = false,
  compact = false,
  home = false,
  onViewAll,
  entityId,
  rootContext = false,
}: {
  groups: NavGroup[];
  workspaceId: unknown;
  onClose: () => void;
  showBack?: boolean;
  welcome?: boolean;
  compact?: boolean;
  /** The global start page shows the three newest chats below the composer. */
  home?: boolean;
  onViewAll?: () => void;
  /** Current content entity. Compact homes show only an exact match unless this is the workspace root. */
  entityId?: unknown;
  rootContext?: boolean;
}) {
  const [loadingTo, setLoadingTo] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [all, setAll] = useState(!workspaceId);
  useEffect(() => setAll(!workspaceId), [workspaceId]);
  const [search, setSearch] = useState("");
  const scoped = groups.find(
    (g) => g.meta?.type === "recent-chats" && g.meta?.workspaceId === workspaceId,
  );
  const allItems =
    (scoped?.meta?.allConversations as NavItem[] | undefined) ??
    groups
      .filter((g) => g.meta?.type === "recent-chats" || g.meta?.type === "pinned-chats")
      .flatMap((g) => g.items);
  const runs = useChatRuns((s) => s.runs);
  const runFor = (item: NavItem) =>
    Object.values(runs).find(
      (run) => (run.conversationUrl ?? `/chat/${encodeURIComponent(run.threadId)}`) === item.to,
    );
  const workspaceItems =
    all || !workspaceId
      ? allItems
      : ((scoped?.meta?.workspaceConversations as NavItem[] | undefined) ?? scoped?.items ?? []);
  // In-memory runs appear immediately, before the server refreshes its nav rows.
  // A persisted title/actions win, while the live run owns its current location.
  const merged = new Map(workspaceItems.map((item) => [item.to, item]));
  for (const run of Object.values(runs)) {
    const to = run.conversationUrl ?? `/chat/${encodeURIComponent(run.threadId)}`;
    const saved = allItems.find((item) => item.to === to);
    if (saved && !isChatRunActive(run)) continue;
    if (!all && workspaceId && !merged.has(to) && run.contextMeta?.spacesRootId !== workspaceId) {
      merged.delete(to);
      continue;
    }
    merged.set(to, {
      ...saved,
      to,
      label: saved?.label ?? run.title,
      icon: MessageSquare,
      meta: {
        ...saved?.meta,
        previewEntityId: run.contextMeta?.spacesEntityId ?? saved?.meta?.previewEntityId,
        previewEntityName: run.pageLabel ?? saved?.meta?.previewEntityName,
      },
    });
  }
  const items = [...merged.values()]
    .filter(
      (item) =>
        !(compact && workspaceId && !rootContext) ||
        (Boolean(entityId) && item.meta?.previewEntityId === entityId),
    )
    .filter((item) => !["show-all-chats", "no-chats-placeholder"].includes(String(item.meta?.type)))
    .filter((item) => item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => {
      const active = (item: NavItem) => {
        const run = runFor(item);
        return run && isChatRunActive(run) ? 1 : 0;
      };
      return home
        ? 0
        : active(b) - active(a) ||
            Number(Boolean(b.meta?.pinned)) - Number(Boolean(a.meta?.pinned));
    });
  const visibleItems = compact ? items.slice(0, 3) : items;
  const activeItems = visibleItems.filter((item) => {
    const run = runFor(item);
    return run && isChatRunActive(run);
  });
  const idleItems = visibleItems.filter((item) => !activeItems.includes(item));
  const pinnedItems = idleItems.filter((item) => item.meta?.pinned);
  const sections = compact
    ? [{ label: "", items: visibleItems }]
    : [
        { label: "Running", items: activeItems },
        { label: "Pinned", items: pinnedItems },
        {
          label: activeItems.length || pinnedItems.length ? "Recent chats" : "",
          items: idleItems.filter((item) => !item.meta?.pinned),
        },
      ];
  return (
    <section
      data-conversation-history
      aria-label={compact ? "Recent conversations" : "Chat history"}
      className={
        compact ? "w-full" : "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-4"
      }
    >
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
      {(!compact || items.length > 0) && (
        <div
          className={
            home
              ? "mb-2 mt-5 flex items-center justify-between px-1"
              : "mb-2 mt-2 flex items-center justify-between"
          }
        >
          <h2
            className={
              compact ? "text-xs font-medium text-muted-foreground" : "text-base font-semibold"
            }
          >
            {home ? "Recent chats" : compact ? "Recent conversations" : "Conversation history"}
          </h2>
          {home && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              View all
            </button>
          )}
        </div>
      )}
      {Boolean(workspaceId) && !compact && (
        <div className="mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label="History filter"
                className="w-full justify-between font-normal shadow-none"
              >
                <span className="truncate">
                  {all ? "All conversations" : "Last used in this workspace"}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {[
                { value: false, label: "Last used in this workspace" },
                { value: true, label: "All conversations" },
              ].map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  role="menuitemradio"
                  aria-checked={all === option.value}
                  onSelect={() => setAll(option.value)}
                >
                  <span className="flex-1">{option.label}</span>
                  {all === option.value && <Check className="size-4" aria-hidden="true" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {!compact && (
        <Input
          aria-label="Search chats"
          placeholder="Search chats"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-3"
        />
      )}
      <span className="sr-only" role="status">
        {copiedId ? "Chat ID copied" : ""}
      </span>
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
                <h3
                  data-conversation-section-label
                  className="px-2 py-2 text-xs font-medium text-muted-foreground"
                >
                  {section.label}
                </h3>
              )}
              {section.items.map((item) =>
                item.disabled ? (
                  <p key={item.to} className="py-3 text-sm text-muted-foreground">
                    {item.label}
                  </p>
                ) : (
                  <div
                    key={item.to}
                    className={
                      home
                        ? "group mb-1 flex items-center rounded-xl border border-border/70 bg-muted/20 transition-colors hover:border-primary/30 hover:bg-muted/50"
                        : "group flex items-center rounded-lg hover:bg-muted"
                    }
                  >
                    <Link
                      to={item.to}
                      onClick={(event) => {
                        if (loadingTo) {
                          event.preventDefault();
                          return;
                        }
                        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                          return;
                        {
                          const resume = new CustomEvent("preview:resume-chat", {
                            cancelable: true,
                            detail: {
                              to: item.to,
                              complete: (error?: string) => {
                                setLoadingTo(null);
                                if (error) setLoadError(error);
                                else onClose();
                              },
                            },
                          });
                          setLoadingTo(item.to);
                          setLoadError(null);
                          if (!window.dispatchEvent(resume)) {
                            event.preventDefault();
                            return;
                          }
                        }
                        setLoadingTo(null);
                        onClose();
                      }}
                      data-conversation-row
                      className={
                        home
                          ? "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                          : "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                      }
                    >
                      {loadingTo === item.to ? (
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-muted-foreground"
                          aria-label="Opening chat"
                        />
                      ) : runFor(item)?.status === "running" ? (
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                          aria-hidden
                        />
                      ) : runFor(item)?.status === "waiting" ? (
                        <PauseCircle className="size-4 shrink-0 text-primary" aria-hidden />
                      ) : item.meta?.pinned ? (
                        <Pin
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Pinned chat"
                        />
                      ) : (
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>{" "}
                        {runFor(item) && isChatRunActive(runFor(item)!) ? (
                          <span className="block text-xs text-primary">
                            {runFor(item)?.status === "waiting" ? "Waiting for you" : "Running"}
                          </span>
                        ) : (
                          (!compact || rootContext) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {!all &&
                              typeof item.meta?.previewEntityName === "string" &&
                              item.meta.previewEntityName
                                ? `Last at ${item.meta.previewEntityName}`
                                : !all
                                  ? "Last in this workspace"
                                  : typeof item.meta?.previewSpaceName === "string" &&
                                      item.meta.previewSpaceName
                                    ? `Last in ${item.meta.previewSpaceName}`
                                    : item.meta?.previewContextUnavailable
                                      ? "Location unavailable"
                                      : "Last outside a workspace"}
                            </span>
                          )
                        )}
                      </span>
                    </Link>
                    {
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${item.label}`}
                            className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-background"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              const rawId =
                                runFor(item)?.threadId ??
                                item.meta?.conversationId ??
                                item.to.split("/chat/")[1]?.split(/[?#]/)[0];
                              if (typeof rawId !== "string" || !rawId) return;
                              const id = rawId;
                              void Promise.resolve()
                                .then(() =>
                                  navigator.clipboard.writeText(decodeURIComponent(String(id))),
                                )
                                .then(() => {
                                  setCopiedId(id);
                                  setLoadError(null);
                                })
                                .catch(() =>
                                  setLoadError(
                                    `Could not copy. Chat ID: ${decodeURIComponent(id)}`,
                                  ),
                                );
                            }}
                          >
                            <Copy className="size-4" />
                            Copy chat ID
                          </DropdownMenuItem>
                          {Boolean(item.actions?.length) && <DropdownMenuSeparator />}

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
                    }
                  </div>
                ),
              )}
            </section>
          ))}
        {items.length === 0 && !compact && (
          <p className="py-3 text-sm text-muted-foreground">
            {search ? "No matching chats" : "No chats yet"}
          </p>
        )}
      </div>
      {compact && onViewAll && !home && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewAll}
          className="mt-1 h-9 w-fit gap-2 px-2 text-sm font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
        >
          <MessagesSquare className="size-4" aria-hidden />
          Conversation history
        </Button>
      )}
    </section>
  );
}
