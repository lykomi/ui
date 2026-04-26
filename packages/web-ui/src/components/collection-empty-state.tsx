import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

import { cn } from "@iloveagents/foundry-web-primitives";

export function CollectionEmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon | null;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center rounded-[1.75rem] bg-muted/18 px-6 py-10 text-center ring-1 ring-border/35",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-background/85 text-primary shadow-[0_8px_24px_-18px_rgb(15_23_42/0.35)]">
          <Icon className="size-6" />
        </div>
      ) : null}
      <div className="text-base font-semibold text-foreground">{title}</div>
      {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
