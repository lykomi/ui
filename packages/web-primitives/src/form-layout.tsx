import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils.ts";

/** Opinionated single-column form body. Does not create a nested HTML form.
 *  Uses the host's Tailwind spacing unit, surface colors and radius tokens. */
export function FormLayout({
  density = "comfortable",
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  density?: "comfortable" | "compact";
}) {
  return (
    <div
      {...props}
      data-form-layout
      data-form-density={density}
      className={cn(
        "grid min-w-0 text-foreground",
        density === "compact" ? "gap-4" : "gap-8",
        className,
      )}
    />
  );
}
