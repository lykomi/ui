import type { FC } from "react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { Camera, Paperclip, Plus } from "lucide-react";
import { Button, cn } from "@lykomi/web-primitives";
import { CaptureViewAction } from "./capture-view-menu-item.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";

export interface ComposerAddMenuProps {
  /** Bubble-composer sizing. */
  compact?: boolean;
  /** Optional manual screen capture. Internal agent view capture is independent. */
  showCapture?: boolean;
}

export const ComposerAddMenu: FC<ComposerAddMenuProps> = ({
  compact = false,
  showCapture = false,
}) => {
  const icon = compact ? "size-3.5" : "size-4";

  return (
    <CaptureViewAction>
      {(capture, pending) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* A plain Button, not TooltipIconButton: that component's root is a
            Radix Tooltip provider rather than a DOM node, so the trigger's
            props land on nothing and the menu never opens. The menu's own
            labels do the explaining a tooltip would. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add to this message"
              className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-9")}
            >
              <Plus className={compact ? "size-4" : "size-5"} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="top" className="w-52">
            <ComposerPrimitive.AddAttachment asChild>
              <DropdownMenuItem>
                <Paperclip className={icon} />
                Attach file
              </DropdownMenuItem>
            </ComposerPrimitive.AddAttachment>
            {showCapture && (
              <DropdownMenuItem disabled={pending} onSelect={capture}>
                <Camera className={icon} />
                {pending ? "Capturing…" : "Capture view"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </CaptureViewAction>
  );
};
