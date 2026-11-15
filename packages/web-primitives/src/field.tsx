import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { isFieldControl } from "./field-control.ts";
import { cn } from "./utils.ts";

function unwrapSingleChild(children: ReactNode): ReactNode {
  const nodes = Children.toArray(children);
  if (nodes.length !== 1) return null;
  const child = nodes[0];
  return isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
    ? unwrapSingleChild(child.props.children)
    : child;
}

// A named control with associated help/error; actions stay outside its label.
export function Field({
  label,
  hint,
  error,
  htmlFor,
  action,
  className,
  children,
  agentContext = true,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Disable automatic agent context for private fields. */
  agentContext?: boolean;
}) {
  const id = useId();
  const singleChild = unwrapSingleChild(children);
  const child = isValidElement<{
    id?: string;
    required?: boolean;
    "aria-required"?: boolean | "true" | "false";
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>(singleChild)
    ? singleChild
    : null;
  const singleControl =
    child &&
    (["input", "select", "textarea"].includes(String(child.type)) || isFieldControl(child.type));
  const controlId = htmlFor ?? child?.props.id ?? `${id}-control`;
  const required =
    child?.props.required ||
    child?.props["aria-required"] === true ||
    child?.props["aria-required"] === "true";
  const labelContent = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className="font-normal">
          {" "}
          (Required)
        </span>
      )}
    </>
  );
  const labelClass = "text-sm font-medium text-muted-foreground";
  const descriptions =
    [child?.props["aria-describedby"], hint && `${id}-hint`, error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  const control =
    singleControl && child
      ? cloneElement(child, {
          id: controlId,
          "aria-describedby": descriptions,
          "aria-invalid": error ? true : child.props["aria-invalid"],
        })
      : children;
  return (
    <div
      data-agent-field={id}
      data-agent-context={agentContext ? undefined : "off"}
      className={cn("grid gap-2", className)}
    >
      {singleControl || htmlFor ? (
        <>
          {(label || action) && (
            <div className="flex items-center justify-between gap-3">
              {label ? (
                <label data-agent-field-label htmlFor={controlId} className={labelClass}>
                  {labelContent}
                </label>
              ) : (
                <span />
              )}
              {action}
            </div>
          )}
          {control}
        </>
      ) : (
        <>
          {action && <div className="flex justify-end">{action}</div>}
          <label className="grid gap-2">
            {label && (
              <span data-agent-field-label className={labelClass}>
                {labelContent}
              </span>
            )}
            {control}
          </label>
        </>
      )}
      {hint && (
        <span id={`${id}-hint`} className="block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="block text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

export function FieldSet({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}
