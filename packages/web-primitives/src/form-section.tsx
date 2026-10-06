import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "./utils.ts";
import { FieldSet } from "./field.tsx";

/** One logical group. Keep this mounted while the field values change mode. */
export function FormSection({
  title,
  description,
  level = 3,
  children,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  level?: 2 | 3 | 4;
}) {
  const titleId = useId();
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <section {...props} aria-labelledby={titleId} className={cn("grid min-w-0 gap-4", className)}>
      <div>
        <Heading id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </Heading>
        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      <FieldSet>{children}</FieldSet>
    </section>
  );
}
