import { useAuiState } from "@assistant-ui/react";
import { Button } from "@lykomi/web-primitives";
import { PanelRight } from "lucide-react";
import { getOpenPanelOutput, OPEN_PANEL_TOOL_NAME } from "../lib/open-panel-output.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";

export function OpenPanelOutputs({ indices }: { indices: readonly number[] }) {
  const parts = useAuiState((state) => state.message.parts);

  return indices.map((index) => {
    const part = parts[index];
    if (
      part?.type !== "tool-call" ||
      part.toolName !== OPEN_PANEL_TOOL_NAME ||
      part.status.type !== "complete" ||
      part.isError
    ) {
      return null;
    }

    const panel = getOpenPanelOutput(part.args, part.result);
    if (!panel?.content) return null;

    return (
      <div
        key={part.toolCallId}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          <PanelRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="wrap-anywhere text-sm font-medium">{panel.title}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Open panel — ${panel.title}`}
          onClick={() => useToolPanelStore.getState().openPanel(panel)}
        >
          Open panel
        </Button>
      </div>
    );
  });
}
