import type { ReactNode } from "react";
import { ChatHomeStartersSlot } from "./chat-slots.tsx";

/** One compact conversation home for workbench, focus and embedded chat panes. */
export function ChatEmptyState({
  pageLabel,
  children,
  showHomeStarters = true,
  homeStarterPriority = 0,
}: {
  pageLabel?: string;
  children?: ReactNode;
  showHomeStarters?: boolean;
  homeStarterPriority?: number;
}) {
  return (
    <div className="flex min-h-full flex-col justify-start gap-3 px-6 pb-8 pt-0">
      <h1 className="text-lg font-semibold tracking-tight">What would you like to get done?</h1>
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
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        Your conversation continues as you browse. Select text or a field to work more specifically.
      </p>
      {showHomeStarters && <ChatHomeStartersSlot priority={homeStarterPriority} />}
      {children}
    </div>
  );
}
