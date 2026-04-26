import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@iloveagents/foundry-web-primitives";

const surfaceCardVariants = cva("border border-border shadow-sm", {
  variants: {
    tone: {
      default: "bg-card",
      subtle: "bg-background/80",
      muted: "bg-muted/10",
      empty: "border-dashed bg-muted/10 text-sm text-muted-foreground",
    },
    radius: {
      md: "rounded-xl",
      lg: "rounded-[1.5rem]",
      xl: "rounded-[2rem]",
    },
    padding: {
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
      xl: "p-7",
    },
  },
  defaultVariants: {
    tone: "default",
    radius: "lg",
    padding: "md",
  },
});

export function SurfaceCard({
  className,
  tone,
  radius,
  padding,
  ...props
}: ComponentPropsWithoutRef<"div"> & VariantProps<typeof surfaceCardVariants>) {
  return (
    <div className={cn(surfaceCardVariants({ tone, radius, padding }), className)} {...props} />
  );
}

export { surfaceCardVariants };
