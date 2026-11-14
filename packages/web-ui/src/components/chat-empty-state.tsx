import type { ReactNode } from "react";
import { ChatHomeStartersSlot } from "./chat-slots.tsx";
import { useNavStore } from "../lib/nav-store.ts";

/** One compact conversation home for workbench, focus and embedded chat panes. */
export function ChatEmptyState({
  pageLabel,
  contextLoading,
  children,
  showHomeStarters = true,
  homeStarterPriority = 0,
}: {
  pageLabel?: string;
  /** The host knows whether its current location label is settled. */
  contextLoading?: boolean;
  children?: ReactNode;
  showHomeStarters?: boolean;
  homeStarterPriority?: number;
}) {
  const navigationLoading = useNavStore((state) => state.navLoading);
  const loadingContext =
    contextLoading ?? (navigationLoading && (!pageLabel || pageLabel.startsWith("/")));
  return (
    <div data-chat-empty-state className="flex flex-col gap-3 px-4 pb-4 pt-3">
      <h1 className="text-base leading-6 font-semibold">What would you like to get done?</h1>
      {loadingContext ? (
        <div
          role="status"
          aria-label="Loading chat context"
          aria-busy="true"
          className="max-w-sm space-y-2 py-1"
        >
          <div
            aria-hidden="true"
            className="h-4 w-full rounded bg-muted motion-safe:animate-pulse"
          />
          <div
            aria-hidden="true"
            className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse"
          />
        </div>
      ) : (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {pageLabel && !pageLabel.startsWith("/") && !/^chat$/i.test(pageLabel) ? (
            <>
              Ask about <span className="font-medium text-foreground">{pageLabel}</span> or start a
              new task.
            </>
          ) : (
            "Ask a question, start a task, or try one of the prompts below."
          )}
        </p>
      )}
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        Your conversation stays open as you move through the app.
      </p>
      {showHomeStarters && <ChatHomeStartersSlot priority={homeStarterPriority} />}
      {children}
    </div>
  );
}
