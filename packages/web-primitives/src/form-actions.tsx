import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils.ts";

/** Actions wrap in narrow panes; the primary action belongs last. */
export function FormActions({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={cn("flex flex-wrap items-center gap-2", className)} />;
}
