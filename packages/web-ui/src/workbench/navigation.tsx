import { Sidebar, UserMenu, ThemeToggle, type NavGroup } from "../index.ts";
import { SelectionBridge } from "./selection-bridge.tsx";
export function WorkbenchNavigation({
  groups,
  workspace,
  onNewConversation,
  uiPreviewAvailable,
}: {
  groups: NavGroup[];
  workspace: boolean;
  onNewConversation: () => void;
  uiPreviewAvailable?: boolean;
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
            className="shrink-0 border-t border-sidebar-border bg-sidebar px-2 py-2"
            aria-label="Account and appearance"
          >
            <div className="flex min-w-0 items-center justify-between gap-1">
              <UserMenu uiPreviewAvailable={uiPreviewAvailable} />
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
            <UserMenu uiPreviewAvailable={uiPreviewAvailable} />
          </footer>
        }
      />
    </SelectionBridge>
  );
}
