import { type FC } from "react";
import { Link } from "react-router";
import { SquarePen, Menu } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { AppBrand } from "./app-brand.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { ThemeToggle } from "./theme-toggle.tsx";
import { UserMenu } from "./user-menu.tsx";
import { useSidebarStore } from "../lib/sidebar-store.ts";
import { useNewConversation } from "../lib/use-new-conversation.ts";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";

export const ChatHeader: FC = () => {
  const isExpanded = useChatBubbleStore((s) => s.isExpanded);
  // In expanded mode the default "navigate to /" would land on the chat
  // route, and the shell collapses expanded chat there — so New Thread
  // silently threw the user out of the mode they were working in AND off
  // the page they were reading. Expanded starts the thread in place, the
  // same contract the bubble already uses.
  const handleNewConversation = useNewConversation(
    isExpanded ? { navigateToChat: false, preserveNavigation: true } : undefined,
  );
  const toggleMobile = useSidebarStore((s) => s.toggleMobile);
  const isSidebarOpen = useSidebarStore((s) => s.isOpen);

  return (
    <div className={cn("shrink-0", "bg-background border-b border-border")}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TooltipIconButton tooltip="Open sidebar" onClick={toggleMobile} className="md:hidden">
            <Menu className="size-5" />
          </TooltipIconButton>
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2.5 hover:opacity-80 transition-opacity",
              isSidebarOpen && "md:hidden",
            )}
          >
            <AppBrand labelClassName="text-sm font-semibold text-foreground" />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <TooltipIconButton tooltip="New Thread" size="icon" onClick={handleNewConversation}>
            <SquarePen className="size-4 text-primary" />
          </TooltipIconButton>
          <UserMenu />
        </div>
      </div>
    </div>
  );
};
