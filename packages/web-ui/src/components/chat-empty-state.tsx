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
    <div
      data-chat-empty-state
      className="flex min-h-full flex-col justify-start gap-3 px-4 pb-8 pt-3"
    >
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
          {pageLabel && !pageLabel.startsWith("/") ? (
            <>
              Work with <span className="font-medium text-foreground">{pageLabel}</span> or across
              your spaces: find information, create or edit content, and run actions.
            </>
          ) : (
            "Find information, create or edit content, and run actions across your spaces."
          )}
        </p>
      )}
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        Your chat continues as you browse. Select text or a field to work more specifically.
      </p>
      {showHomeStarters && <ChatHomeStartersSlot priority={homeStarterPriority} />}
      {children}
    </div>
  );
}
