import { type ReactNode } from "react";
import { TooltipIconButton, ToolPanelLayout } from "../index.ts";
import { PanelRight } from "lucide-react";
import { useChatWidth } from "./use-chat-width.ts";
export function WorkbenchContentPane({
  contentHidden,
  panelOpen,
  chatWidth,
  contentCollapsed,
  collapsed,
  setCollapsed,
  setContentCollapsed,
  buttonClass,
  closePanel,
  page,
}: {
  contentHidden: boolean;
  panelOpen: boolean;
  chatWidth: ReturnType<typeof useChatWidth>;
  contentCollapsed: boolean;
  collapsed: boolean;
  buttonClass: string;
  setCollapsed: (v: boolean) => void;
  setContentCollapsed: (v: boolean) => void;
  closePanel: () => void;
  page: ReactNode;
}) {
  return (
    <section
      id="preview-content"
      aria-label="Working content"
      data-working-content
      data-panel-motion
      data-content-collapsed={contentHidden || undefined}
      inert={contentHidden}
      data-item-panel-open={panelOpen || undefined}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        display: contentHidden ? "none" : "flex",
        minWidth: chatWidth.compact ? 0 : contentCollapsed ? 44 : collapsed ? 320 : 440,
        transform: "translateZ(0)",
        isolation: "isolate",
      }}
    >
      {!chatWidth.compact && (
        <TooltipIconButton
          data-content-collapse
          tooltip="Collapse content"
          className={buttonClass}
          aria-label="Collapse content"
          onClick={() => {
            setCollapsed(false);
            setContentCollapsed(true);
          }}
        >
          <PanelRight size={18} />
        </TooltipIconButton>
      )}
      <div
        className="min-h-0 flex-1 flex-col overflow-hidden"
        style={{ display: contentHidden ? "none" : "flex" }}
      >
        {panelOpen && (
          <div
            className="flex shrink-0 items-center border-b border-border pl-3 pr-14"
            style={{ minHeight: 60 }}
          >
            <button onClick={closePanel}>← Back to content</button>
          </div>
        )}
        <ToolPanelLayout contained>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{page}</div>
        </ToolPanelLayout>
      </div>
    </section>
  );
}
