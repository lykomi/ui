import * as React from "react";

import { cn } from "./utils.ts";
import { markFieldControl } from "./field-control.ts";

const inputClassName =
  "flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return <input ref={ref} type={type} className={cn(inputClassName, className)} {...props} />;
  },
);
Input.displayName = "Input";
markFieldControl(Input);

export { Input, inputClassName };
