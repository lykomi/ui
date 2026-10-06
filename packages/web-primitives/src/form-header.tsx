import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "./utils.ts";
import { FormActions } from "./form-actions.tsx";

/** Identity and related actions share one wrapping, theme-aware title row. */
export function FormHeader({
  title,
  description,
  actions,
  level = 2,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"header">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level}` as "h1" | "h2" | "h3";
  return (
    <header
      {...props}
      className={cn("flex min-w-0 flex-wrap items-start justify-between gap-4", className)}
    >
      <div className="min-w-0">
        <Heading className="break-words text-base font-semibold leading-6 text-foreground">
          {title}
        </Heading>
        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <FormActions>{actions}</FormActions>}
    </header>
  );
}
