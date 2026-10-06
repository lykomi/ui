import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Checkbox } from "./checkbox.tsx";
import { Input } from "./input.tsx";
import { Textarea } from "./textarea.tsx";
import { cn } from "./utils.ts";

// A named control with associated help/error; actions stay outside its label.
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
  const id = useId();
  const child = isValidElement<{
    id?: string;
    required?: boolean;
    "aria-required"?: boolean | "true" | "false";
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>(children)
    ? children
    : null;
  const singleControl =
    child &&
    (["input", "select", "textarea"].includes(String(child.type)) ||
      child.type === Checkbox ||
      child.type === Input ||
      child.type === Textarea);
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
  const labelClass = "text-xs font-medium text-muted-foreground";
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
    <div className={cn("grid gap-1.5", className)}>
      {singleControl || htmlFor ? (
        <>
          {(label || action) && (
            <div className="flex items-center justify-between gap-3">
              {label ? (
                <label htmlFor={controlId} className={labelClass}>
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
          <label className="grid gap-1.5">
            {label && <span className={labelClass}>{labelContent}</span>}
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
