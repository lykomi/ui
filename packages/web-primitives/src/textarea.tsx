import * as React from "react";

import { cn } from "./utils.ts";

const textareaClassName =
  "flex [field-sizing:content] leading-6 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return <textarea ref={ref} className={cn(textareaClassName, className)} {...props} />;
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaClassName };
