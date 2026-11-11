import { useEffect } from "react";
import { ConversationHistory } from "./conversation-history.tsx";
import { useAppStore } from "../lib/app-store.ts";
import type { NavGroup } from "../lib/nav-config.ts";

/** The history library is working content; the assistant remains the same panel. */
export function HistoryContent({
  groups,
  onResume,
  onNewChat,
}: {
  groups: NavGroup[];
  onResume: () => void;
  onNewChat: () => void;
}) {
  useEffect(() => {
    const store = useAppStore.getState();
    store.setContextItem("chat-history-view", {
      type: "page",
      label: "Chat history",
      persistence: "ephemeral",
      sourcePage: "/?view=chat-history",
      payload: {
        kind: "page",
        path: "/?view=chat-history",
        label: "Chat history",
        meta: { componentFocus: "active", componentLabel: "Chat history" },
      },
    });
    return () => useAppStore.getState().setContextItem("chat-history-view", null);
  }, []);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-history-content>
      <header className="flex min-h-14 shrink-0 items-center border-b border-border px-4 pr-14">
        <h1 className="text-base font-semibold">Chat history</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
        <ConversationHistory
          groups={groups}
          workspaceId={undefined}
          onClose={onResume}
          showBack={false}
          onNewChat={onNewChat}
        />
      </div>
    </div>
  );
}
