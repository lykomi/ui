import { useState } from "react";
import { GripVertical, PanelsTopLeft, X } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import { PinToggle } from "../components/pin-toggle.tsx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu.tsx";
import { useWindowReorder } from "./window-reorder.tsx";
import type { WindowController, WorkbenchWindow } from "./window-controller.ts";

export function WindowPanelActions<T extends WorkbenchWindow>({
  controller,
  tab,
  onShowTab,
}: {
  controller: WindowController<T>;
  tab: T;
  onShowTab?: () => void;
}) {
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const reorder = useWindowReorder(tab.id, controller);
  const tabs = controller.get().tabs;
  const name = typeof tab.title === "string" ? tab.title : "item";
  const showTab = () => {
    onShowTab?.();
    controller.select(tab.id);
    controller.setLayout("tabs", { remember: true });
  };
  return (
    <span data-item-window-controls className="ml-auto inline-flex shrink-0 items-center gap-0.5">
      <DropdownMenu open={arrangeOpen} onOpenChange={setArrangeOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Arrange ${name}`}
            title="Drag to reorder, or click for layout options"
            style={{ touchAction: "none" }}
            {...reorder}
            onPointerDown={(event) => {
              reorder.onPointerDown(event);
              event.preventDefault();
            }}
            onClick={() => setArrangeOpen((value) => !value)}
          >
            <GripVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={tabs[0]?.id === tab.id}
            onSelect={() => controller.move(tab.id, tabs.findIndex((t) => t.id === tab.id) - 1)}
          >
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={tabs[tabs.length - 1]?.id === tab.id}
            onSelect={() => controller.move(tab.id, tabs.findIndex((t) => t.id === tab.id) + 1)}
          >
            Move right
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => (tab.kept ? controller.unkeep(tab.id) : controller.keep(tab.id))}
          >
            {tab.kept ? "Unpin panel" : "Pin panel"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={showTab}>Show as tab</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => controller.resize(tab.id)}>
            Reset panel width
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {controller.hasDraft(tab) && (
        <span
          className="px-1 text-xs text-muted-foreground"
          aria-label="Unsaved changes"
          title="Unsaved changes"
        >
          •
        </span>
      )}
      <span data-item-window-secondary className="inline-flex items-center gap-0.5">
        <PinToggle
          pinned={Boolean(tab.kept)}
          label={name}
          title={tab.kept ? "Pinned — click to unpin" : "Pin to keep open"}
          className="size-9 [@media(pointer:coarse)]:size-11"
          onClick={() => (tab.kept ? controller.unkeep(tab.id) : controller.keep(tab.id))}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Show ${name} as a tab`}
          title="Show this item as a tab"
          onClick={showTab}
        >
          <PanelsTopLeft />
        </Button>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Close ${name}`}
        title="Close panel"
        onClick={tab.close}
      >
        <X />
      </Button>
    </span>
  );
}
