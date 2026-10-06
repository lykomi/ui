import {
  cloneElement,
  Fragment,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "./utils.ts";

function isEmptyValue(value: ReactNode): boolean {
  if (
    isValidElement<{ children?: ReactNode }>(value) &&
    (value.type === Fragment || (typeof value.type === "string" && "children" in value.props))
  )
    return isEmptyValue(value.props.children);
  return Array.isArray(value)
    ? value.every(isEmptyValue)
    : value === null || value === undefined || value === "";
}

// Boolean data must survive the arrays/fragments React otherwise suppresses.
function displayValue(value: ReactNode): ReactNode {
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayValue);
  if (
    isValidElement<{ children?: ReactNode }>(value) &&
    (value.type === Fragment || typeof value.type === "string")
  )
    return cloneElement(value, {}, displayValue(value.props.children));
  return value;
}

/** Readable label/value pair; keeps the Field rhythm without a disabled input. */
export function ReadOnlyField({
  label,
  hint,
  emptyLabel = "Not set",
  children,
  multiline = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"dl"> & {
  label: ReactNode;
  multiline?: boolean;
  hint?: ReactNode;
  emptyLabel?: ReactNode;
}) {
  const empty = isEmptyValue(children);
  return (
    <dl {...props} className={cn("grid min-w-0 gap-1.5", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "m-0 min-h-10 min-w-0 break-words whitespace-pre-wrap rounded-xl border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground",
          multiline && "min-h-24 leading-6",
        )}
      >
        {empty ? (
          <span className="text-muted-foreground">{emptyLabel}</span>
        ) : (
          displayValue(children)
        )}
      </dd>
      {hint && <dd className="m-0 text-xs text-muted-foreground">{hint}</dd>}
    </dl>
  );
}
