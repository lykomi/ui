import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu.tsx";
import { Button, Input } from "@iloveagents/foundry-web-primitives";
import { Fragment, useState } from "react";
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
import { useNavStore } from "../lib/nav-store.ts";
import { ActionListSkeleton } from "../components/action-list-skeleton.tsx";

import { useChatRuns, isChatRunActive } from "../lib/chat-runs-store.ts";

import { useHistoryPreview } from "./history-preview.tsx";

const HOME_SECTION_LIMIT = 5;

function conversationTime(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : minutes < 10080
          ? `${Math.floor(minutes / 1440)}d ago`
          : new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
  standalone = false,
  onNewChat,
}: {
  groups: NavGroup[];
  workspaceId: unknown;
  onClose: () => void;
  showBack?: boolean;
  welcome?: boolean;
  compact?: boolean;
  /** The global start page shows recent and pinned chats below the composer. */
  home?: boolean;
  onViewAll?: () => void;
  /** Current content entity. Compact homes show only an exact match unless this is the workspace root. */
  entityId?: unknown;
  rootContext?: boolean;
  /** Full history view entered from the global Home/chat surface. */
  standalone?: boolean;
  onNewChat?: () => void;
}) {
  const previewEnabled = groups.some((group) => group.meta?.historyPreview === true);
  const preview = useHistoryPreview(previewEnabled, workspaceId);
  const [loadingTo, setLoadingTo] = useState<string | null>(null);
  const navigationLoading = useNavStore((state) => state.navLoading);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyScope, setHistoryScope] = useState({ workspaceId, all: !workspaceId });
  const all = historyScope.workspaceId === workspaceId ? historyScope.all : !workspaceId;
  if (historyScope.workspaceId !== workspaceId) setHistoryScope({ workspaceId, all: !workspaceId });
  const setAll = (value: boolean) => setHistoryScope({ workspaceId, all: value });
  const [search, setSearch] = useState("");
  const scoped = groups.find(
    (g) => g.meta?.type === "recent-chats" && g.meta?.workspaceId === workspaceId,
  );
  const historyGroups = workspaceId
    ? scoped
      ? [scoped]
      : []
    : groups.filter(
        (group) => group.meta?.type === "recent-chats" || group.meta?.type === "pinned-chats",
      );
  const historyLoading =
    historyGroups.some((group) => group.loading) ||
    (navigationLoading && historyGroups.length === 0);
  const allItems =
    (scoped?.meta?.allConversations as NavItem[] | undefined) ??
    groups
      .filter((g) => g.meta?.type === "recent-chats" || g.meta?.type === "pinned-chats")
      .flatMap((g) => (g.meta?.allConversations as NavItem[] | undefined) ?? g.items);
  const savedTargets = new Set(allItems.map((item) => item.to));
  const hasServerTimestamps = allItems.some((item) => typeof item.meta?.updatedAt === "string");
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
  const merged = new Map([...workspaceItems, ...preview.items].map((item) => [item.to, item]));
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
        Boolean(item.meta?.pinned || item.meta?.previewSample) ||
        (Boolean(entityId) && item.meta?.previewEntityId === entityId),
    )
    .filter((item) => !["show-all-chats", "no-chats-placeholder"].includes(String(item.meta?.type)))
    .filter((item) =>
      [item.label, item.meta?.previewSpaceName, item.meta?.previewEntityName]
        .filter((value) => typeof value === "string")
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => {
      const active = (item: NavItem) => {
        const run = runFor(item);
        return run && isChatRunActive(run) ? 1 : 0;
      };
      if (home) {
        // The server list can lag a just-finished run. Compare its session
        // timestamp with server timestamps so newer chats from other tabs
        // take priority as soon as navigation refreshes.
        const activityAt = (item: NavItem) => {
          const updatedAt = item.meta?.updatedAt;
          const serverAt = typeof updatedAt === "string" ? Date.parse(updatedAt) || 0 : 0;
          const run = runFor(item);
          const sessionAt =
            run && (hasServerTimestamps || !savedTargets.has(item.to))
              ? (run.finishedAt ?? run.startedAt)
              : 0;
          return Math.max(serverAt, sessionAt);
        };
        return active(b) - active(a) || activityAt(b) - activityAt(a);
      }
      return (
        active(b) - active(a) || Number(Boolean(b.meta?.pinned)) - Number(Boolean(a.meta?.pinned))
      );
    });
  const homeRecentItems = home
    ? items.filter((item) => !item.meta?.pinned).slice(0, HOME_SECTION_LIMIT)
    : [];
  const homePinnedItems = home
    ? items.filter((item) => item.meta?.pinned).slice(0, HOME_SECTION_LIMIT)
    : [];
  const visibleItems = compact ? items.slice(0, 3) : items;
  const activeItems = visibleItems.filter((item) => {
    const run = runFor(item);
    return run && isChatRunActive(run);
  });
  const idleItems = visibleItems.filter((item) => !activeItems.includes(item));
  const pinnedItems = idleItems.filter((item) => item.meta?.pinned);
  const sections = home
    ? [
        { label: "Recent", items: homeRecentItems },
        { label: "Pinned", items: homePinnedItems },
      ]
    : compact
      ? [
          { label: "Pinned", items: items.filter((item) => item.meta?.pinned).slice(0, 3) },
          { label: "Recent", items: items.filter((item) => !item.meta?.pinned).slice(0, 3) },
        ]
      : [
          { label: "Running", items: activeItems },
          { label: "Pinned", items: pinnedItems },
          {
            label: activeItems.length || pinnedItems.length ? "Recent" : "",
            items: idleItems.filter((item) => !item.meta?.pinned),
          },
        ];
  return (
    <section
      data-conversation-history
      data-history-standalone={standalone || undefined}
      aria-label={home ? "Home chats" : compact ? "Recent chats" : "Chat history"}
      className={
        home
          ? "w-full"
          : compact
            ? "w-full"
            : standalone
              ? "mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6 pb-6"
              : "flex min-h-0 w-full flex-1 flex-col px-4 pb-4"
      }
    >
      {preview.dialog}
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
      {standalone && (
        <div className="mb-5 text-left">
          <h1 className="text-2xl font-semibold tracking-tight">Chat history</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find and continue your conversations across spaces.
          </p>
        </div>
      )}
      {!standalone && home && (
        <div
          className={
            home
              ? "mb-2 mt-5 flex items-center justify-center px-1 text-center"
              : "mb-4 mt-4 flex items-center justify-between"
          }
        >
          <h2
            className={
              compact ? "text-xs font-medium text-muted-foreground" : "text-base font-semibold"
            }
          >
            {home ? "Your chats" : compact ? "Recent chats" : "Chat history"}
          </h2>
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
                <span className="truncate">{all ? "All spaces" : "This space"}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {[
                { value: false, label: "This space" },
                { value: true, label: "All spaces" },
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
      {previewEnabled && !compact && (
        <div className="my-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{preview.hidden ? "Local preview" : "Includes sample conversations"}</span>
          <Button variant="ghost" size="sm" onClick={preview.toggle}>
            {preview.hidden ? "Show samples" : "Hide samples"}
          </Button>
        </div>
      )}
      {!compact && (
        <Input
          aria-label="Search chats"
          placeholder="Search chats"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-4 h-10"
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
      {!home && items.length === 0 && historyLoading && (
        <ActionListSkeleton label="Loading recent chats" secondaryText />
      )}
      <div
        className={
          home
            ? "grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4"
            : "min-h-0 flex-1 overflow-y-auto"
        }
        aria-busy={Boolean(loadingTo)}
      >
        {sections
          .filter((section) => home || section.items.length)
          .map((section) => (
            <section
              key={section.label}
              aria-label={section.label || "Recent chats"}
              className={
                home
                  ? "min-h-80 min-w-0 rounded-xl border border-border/70 bg-muted/10 p-3"
                  : "mb-4 last:mb-0"
              }
            >
              {section.label && (
                <h3
                  data-conversation-section-label
                  className={
                    home
                      ? "px-1 pb-2 text-xs font-medium text-muted-foreground"
                      : "px-3 pb-2 pt-3 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {section.label}
                </h3>
              )}
              {home && !section.items.length && historyLoading && (
                <ActionListSkeleton
                  label={`Loading ${section.label.toLowerCase()} chats`}
                  rows={3}
                  secondaryText
                />
              )}
              {home && !section.items.length && !historyLoading && (
                <p className="px-1 py-3 text-xs text-muted-foreground">
                  {section.label === "Pinned"
                    ? "Pin chats to keep them close."
                    : "Your latest chats will appear here."}
                </p>
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
                        ? "group flex items-center rounded-lg transition-colors hover:bg-muted/60"
                        : "group flex items-start rounded-lg border-b border-border/50 last:border-b-0 hover:bg-muted/50"
                    }
                  >
                    <Link
                      to={item.to}
                      onClick={(event) => {
                        if (item.meta?.previewSample) {
                          event.preventDefault();
                          preview.open(item);
                          return;
                        }
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
                          ? "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary"
                          : "flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-3 text-sm [&>svg]:mt-0.5 focus-visible:outline-2 focus-visible:outline-primary"
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
                        <span className="block truncate font-medium leading-5">{item.label}</span>
                        {item.description && item.description !== item.label && (
                          <span className="mt-1 block truncate text-sm text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="min-w-0 truncate">
                            {!all &&
                            typeof item.meta?.previewEntityName === "string" &&
                            item.meta.previewEntityName
                              ? `Last at ${item.meta.previewEntityName}`
                              : !all
                                ? "Last in this space"
                                : typeof item.meta?.previewSpaceName === "string" &&
                                    item.meta.previewSpaceName
                                  ? `Last in ${item.meta.previewSpaceName}`
                                  : item.meta?.previewContextUnavailable
                                    ? "Location unavailable"
                                    : "General"}
                          </span>
                          {conversationTime(item.meta?.updatedAt) && (
                            <time
                              className="whitespace-nowrap"
                              dateTime={String(item.meta?.updatedAt)}
                              title={new Date(String(item.meta?.updatedAt)).toLocaleString()}
                            >
                              · {conversationTime(item.meta?.updatedAt)}
                            </time>
                          )}
                        </span>
                        {runFor(item) && isChatRunActive(runFor(item)!) && (
                          <span className="mt-1.5 block text-xs font-medium text-primary">
                            {runFor(item)?.status === "waiting" ? "Waiting for you" : "Working"}
                          </span>
                        )}
                      </span>
                    </Link>
                    {
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${item.label}`}
                            className="mr-1 mt-3 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-background"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!item.meta?.previewSample && (
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
                          )}
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
        {standalone && items.length === 0 && !historyLoading && (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <MessagesSquare className="mb-4 size-8 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold">
              {search ? "No matching chats" : "No conversations yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {search
                ? "Try a different search or clear the filter."
                : "Start a conversation from Home or a workspace. You can find it here later."}
            </p>
            <Button
              className="mt-5 gap-2"
              variant="outline"
              onClick={search ? () => setSearch("") : (onNewChat ?? onClose)}
            >
              {search ? "Clear search" : "Start a chat"}
            </Button>
          </div>
        )}
        {!standalone && items.length === 0 && !historyLoading && !compact && (
          <p className="py-3 text-sm text-muted-foreground">
            {search ? "No matching chats" : "No chats yet"}
          </p>
        )}
      </div>
      {home && onViewAll && (
        <div className="mt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="h-9 w-fit gap-2 px-2 text-sm font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
          >
            <MessagesSquare className="size-4" aria-hidden />
            View all conversations
          </Button>
        </div>
      )}
      {compact && onViewAll && !home && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewAll}
          className="mt-1 h-9 w-fit gap-2 px-2 text-sm font-normal text-muted-foreground [@media(pointer:coarse)]:min-h-11"
        >
          <MessagesSquare className="size-4" aria-hidden />
          View all
        </Button>
      )}
    </section>
  );
}
