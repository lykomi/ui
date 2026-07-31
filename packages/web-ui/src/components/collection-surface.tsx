import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@iloveagents/foundry-web-primitives";

export function CollectionSurface({
  toolbar,
  bordered = false,
  backgrounded = true,
  className,
  toolbarClassName,
  contentClassName,
  children,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  toolbar?: ReactNode;
  bordered?: boolean;
  backgrounded?: boolean;
  toolbarClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-[1.75rem]",
        backgrounded && "bg-card/60 shadow-[0_12px_36px_-24px_rgb(15_23_42/0.18)] backdrop-blur-sm",
        bordered && "ring-1 ring-border/45",
        className,
      )}
      {...props}
    >
      {toolbar ? (
        <div
          className={cn(
            "sticky top-0 z-10 px-4 py-4 sm:px-5",
            backgrounded && "bg-muted/18 backdrop-blur",
            bordered && "border-b border-border/45",
            toolbarClassName,
          )}
        >
          {toolbar}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}
