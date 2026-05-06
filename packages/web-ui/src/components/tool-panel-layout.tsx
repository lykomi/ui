import { cn } from "@iloveagents/foundry-web-primitives";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { ToolPanel } from "./tool-panel.tsx";

/**
 * Layout wrapper that adjusts main content when tool panel is open.
 * - Narrow screens (< 1280px): Full-screen overlay, chat hidden
 * - Wide screens (>= 1280px): Side-by-side layout, chat shifts left
 */
interface ToolPanelLayoutProps {
  children: React.ReactNode;
}

export function ToolPanelLayout({ children }: ToolPanelLayoutProps) {
  const isOpen = useToolPanelStore((state) => state.isOpen);
  const panelWidth = useToolPanelStore((state) => state.panelWidth);
  const useOverlay = useToolPanelStore((state) => state.useOverlay);

  return (
    <div className="relative h-full flex-1 min-w-0 overflow-hidden">
      <div
        className={cn(
          "h-full flex flex-col transition-all duration-300 ease-in-out",
          useOverlay && isOpen && "hidden",
        )}
        style={{
          width: isOpen && !useOverlay ? `calc(100% - ${panelWidth}px)` : "100%",
        }}
      >
        {children}
      </div>

      <ToolPanel />
    </div>
  );
}
