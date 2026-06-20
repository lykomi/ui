import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "@iloveagents/foundry-web-primitives";
import { Input } from "@iloveagents/foundry-web-primitives";
import { FormDialog } from "./form-dialog.tsx";
import { Field } from "@iloveagents/foundry-web-primitives";

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  label = "Name",
  submitLabel = "Create",
  pendingLabel,
  initialValue = "",
  error,
  pending = false,
  extra,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  placeholder: string;
  label?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  initialValue?: string;
  error?: ReactNode;
  pending?: boolean;
  extra?: ReactNode;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={`${inputId}-form`}
            disabled={!value.trim() || pending}
          >
            {pending ? (pendingLabel ?? `${submitLabel}...`) : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={`${inputId}-form`}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const trimmed = value.trim();
          if (!trimmed) return;
          void onSubmit(trimmed);
        }}
      >
        <Field label={label} htmlFor={inputId} error={error}>
          <Input
            id={inputId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            disabled={pending}
            autoFocus
          />
        </Field>
        {extra}
      </form>
    </FormDialog>
  );
}
