import { type CSSProperties } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import { X } from "lucide-react";
import { FocusPaneResize } from "./data-table/focus-pane-resize.tsx";
import { PanelContentRenderer } from "./tool-panel.tsx";
import type { ToolPanelContent } from "../lib/tool-panel-store.ts";
export function FocusSourcePane({
  source,
  sourceWidth,
  setSourceWidth,
  closeSource,
}: {
  source: ToolPanelContent;
  sourceWidth?: number;
  setSourceWidth: (v?: number) => void;
  closeSource: () => void;
}) {
  return (
    <aside
      aria-label="Citation source"
      style={
        {
          "--focus-source-width": sourceWidth ? `${sourceWidth}px` : "40%",
        } as CSSProperties
      }
      data-focus-source-entity={source.entityId}
      data-focus-source-title={source.title}
      className="absolute inset-0 z-20 flex min-h-0 flex-col border-l border-border bg-background xl:relative xl:inset-auto xl:w-[var(--focus-source-width)] xl:min-w-60 xl:shrink-0"
    >
      <FocusPaneResize label="source" side="left" width={sourceWidth} onResize={setSourceWidth} />
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={source.title}>
          {source.title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close citation"
          title="Close citation"
          className="size-8"
          onClick={closeSource}
        >
          <X size={18} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <PanelContentRenderer content={source} />
      </div>
    </aside>
  );
}
