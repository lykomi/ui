import { Sidebar, UserMenu, ThemeToggle, type NavGroup } from "../index.ts";
import { useSidebarStore } from "../lib/sidebar-store.ts";
import { NavLink } from "react-router";
import { ArrowLeft, House } from "lucide-react";
export function WorkbenchNavigation({
  groups,
  workspace,
  onNewConversation,
  historyOpen,
  onHome,
}: {
  groups: NavGroup[];
  workspace: boolean;
  onNewConversation: () => void;
  historyOpen: boolean;
  onHome: () => void;
}) {
  const closeMobile = useSidebarStore((state) => state.closeMobile);
  const activate = (action: () => void) => {
    closeMobile();
    action();
  };
  return (
    <div className="relative flex shrink-0">
      <Sidebar
        groups={groups}
        collapsedGroupsOnly
        hideNewConversation
        newConversationLabel="New chat"
        hideFooterActions={workspace}
        onNewConversation={onNewConversation}
        leadingActions={
          <div className="px-1" data-workbench-navigation-actions>
            <NavLink
              to={workspace ? "/spaces" : "/"}
              state={{ preserveActiveChat: true }}
              end
              className="flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-selected aria-[current=page]:text-sidebar-selected-foreground"
              data-space-exit={workspace || undefined}
              aria-label={workspace ? "All spaces" : "Home"}
              aria-current={workspace || historyOpen ? false : "page"}
              onClick={() => (workspace ? closeMobile() : activate(onHome))}
            >
              {workspace ? (
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
              ) : (
                <House className="size-4 shrink-0" aria-hidden />
              )}
              <span data-action-label>{workspace ? "All spaces" : "Home"}</span>
            </NavLink>
          </div>
        }
        footer={
          <footer
            className="shrink-0 border-t border-sidebar-border px-2 py-2"
            aria-label="Account and appearance"
          >
            <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
              <UserMenu />
              <ThemeToggle />
            </div>
          </footer>
        }
        collapsedFooter={
          <footer
            className="preview-account-compact flex shrink-0 flex-col items-center border-t border-sidebar-border py-2"
            aria-label="Account and appearance"
          >
            <ThemeToggle />
            <UserMenu />
          </footer>
        }
      />
    </div>
  );
}
