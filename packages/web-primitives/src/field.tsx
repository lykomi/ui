import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "./utils.ts";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  action,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)} htmlFor={htmlFor}>
      {label || action ? (
        <span className="flex items-center justify-between gap-3">
          {label ? (
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          ) : (
            <span />
          )}
          {action}
        </span>
      ) : null}
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

export function FieldSet({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}
