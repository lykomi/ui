import {
  cloneElement,
  useId,
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
  valueAppearance = "field",
  className,
  agentContext = true,
  ...props
}: ComponentPropsWithoutRef<"dl"> & {
  label: ReactNode;
  agentContext?: boolean;
  multiline?: boolean;
  /** Field preserves an editable slot; content presents fixed information without input chrome. */
  valueAppearance?: "field" | "content";
  hint?: ReactNode;
  emptyLabel?: ReactNode;
}) {
  const id = useId();
  const empty = isEmptyValue(children);
  return (
    <dl
      {...props}
      data-agent-field={id}
      data-agent-context={agentContext ? undefined : "off"}
      className={cn("grid min-w-0 gap-1.5", className)}
    >
      <dt data-agent-field-label className="text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd
        data-agent-field-value
        data-value-appearance={valueAppearance}
        className={cn(
          "m-0 min-w-0 break-words whitespace-pre-wrap text-sm text-foreground",
          valueAppearance === "field"
            ? "min-h-10 rounded-xl border border-border bg-background px-3 py-2 leading-5"
            : "leading-6",
          multiline && valueAppearance === "field" && "min-h-24 leading-6",
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
