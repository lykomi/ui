import { Sidebar, UserMenu, ThemeToggle, type NavGroup } from "../index.ts";
import { SelectionBridge } from "./selection-bridge.tsx";
export function WorkbenchNavigation({
  groups,
  workspace,
  onNewConversation,
}: {
  groups: NavGroup[];
  workspace: boolean;
  onNewConversation: () => void;
}) {
  return (
    <SelectionBridge>
      <Sidebar
        groups={groups}
        collapsedGroupsOnly
        hideNewConversation
        newConversationLabel="New chat"
        hideFooterActions={workspace}
        onNewConversation={onNewConversation}
        footer={
          <footer
            className="shrink-0 border-t border-sidebar-border px-2 py-2"
            aria-label="Account and appearance"
          >
            <div className="flex min-w-0 items-center justify-between gap-1">
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
    </SelectionBridge>
  );
}
