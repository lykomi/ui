import type { ReactNode } from "react";

import { cn } from "@iloveagents/foundry-web-primitives";

export function CollectionToolbar({
  search,
  filters,
  sort,
  viewToggle,
  actions,
  className,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  sort?: ReactNode;
  viewToggle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">{search}</div>
        <div className="flex flex-wrap items-center gap-2">
          {sort}
          {viewToggle}
          {actions}
        </div>
      </div>
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
    </div>
  );
}
