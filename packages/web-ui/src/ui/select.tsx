import * as React from "react";

import { cn } from "@lykomi/web-primitives";

const selectClassName =
  "flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return <select ref={ref} className={cn(selectClassName, className)} {...props} />;
  },
);
Select.displayName = "Select";

export { Select, selectClassName };
