import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "./utils.ts";
import { markFieldControl } from "./field-control.ts";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-4 shrink-0 rounded border border-border bg-background shadow-sm outline-none transition",
      "focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      // "Some of these" is a state of its own. Left unstyled it drew a tick
      // on a white box — the one shape that reads as "not selected".
      "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    {/* The glyph follows the state Radix RESOLVED, not the prop the caller
        passed: `defaultChecked="indeterminate"` never sets `checked`, and an
        uncontrolled box moves on click. Read off this indicator's own
        `data-state` — a `group-*` variant would also match any ancestor that
        happens to carry `.group` and a `data-state` of its own. */}
    <CheckboxPrimitive.Indicator
      className={cn(
        "flex items-center justify-center text-current",
        "data-[state=indeterminate]:[&_[data-glyph=check]]:hidden",
        "data-[state=indeterminate]:[&_[data-glyph=minus]]:block",
      )}
    >
      <Check data-glyph="check" className="size-3.5" />
      <Minus data-glyph="minus" className="hidden size-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
markFieldControl(Checkbox);

export { Checkbox };
