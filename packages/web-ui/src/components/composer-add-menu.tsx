/**
 * The composer's leading "+" — one affordance for everything you can add to
 * a turn.
 *
 * It replaces a row of single-purpose icons (paperclip, pin, and whatever
 * came next). That row grows every time the product learns a new trick, and
 * each icon costs the user a guess about what it does; a labelled menu costs
 * one click and reads itself. Pinning in particular is a power feature that
 * does not deserve permanent residency next to the text field.
 *
 * Attaching still goes through `ComposerPrimitive.AddAttachment`, so the
 * file picker keeps whatever `accept` filter the registered attachment
 * adapter declares — reimplementing the picker here would drift from it.
 */

import type { FC } from "react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { Paperclip, Pin, PinOff, Plus } from "lucide-react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { usePagePin } from "./context-bar.tsx";

export interface ComposerAddMenuProps {
  /** Bubble-composer sizing. */
  compact?: boolean;
  /**
   * Offer "Pin this page". A bare composer with no page behind it (or a host
   * that does not use page context) opts out.
   */
  showPin?: boolean;
}

export const ComposerAddMenu: FC<ComposerAddMenuProps> = ({ compact = false, showPin = true }) => {
  const { isPinned, toggle } = usePagePin();
  const icon = compact ? "size-3.5" : "size-4";

  return (
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

        {showPin && (
          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu anchored while the pin badge appears, so the
              // user sees the result of what they just clicked.
              event.preventDefault();
              toggle();
            }}
          >
            {isPinned ? <PinOff className={icon} /> : <Pin className={icon} />}
            {isPinned ? "Unpin this page" : "Pin this page"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
