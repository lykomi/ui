import { useRef } from "react";
import {
  Button,
  Field,
  FormHeader,
  FormLayout,
  Input,
  cn,
  inputClassName,
  textareaClassName,
  Textarea,
} from "@lykomi/web-primitives";
import { guideWindows, type GuideWindow } from "./guide-windows.ts";

/** Values belong to the app; the same fields serve manual and agent edits. */
export function DraftForm({ tab }: { tab: GuideWindow }) {
  const editButton = useRef<HTMLButtonElement>(null);
  const finish = (save: boolean) => {
    guideWindows.update(tab.id, {
      ...(save ? {} : tab.saved),
      saved: undefined,
      editing: false,
      dirty: false,
    });
    requestAnimationFrame(() => editButton.current?.focus());
  };
  return (
    <FormLayout
      className="mt-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && tab.editing) {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
    >
      <FormHeader
        title="Working draft"
        level={1}
        description="Describe your app. Select a field, then ask the agent to help with it. Changes stay in this browser session; no storage service is connected."
        actions={
          tab.editing ? (
            <>
              <Button variant="outline" onClick={() => finish(false)}>
                Cancel
              </Button>
              <Button onClick={() => finish(true)}>Save draft</Button>
            </>
          ) : (
            <Button
              ref={editButton}
              onClick={() =>
                guideWindows.update(tab.id, {
                  saved: { name: tab.name ?? "", text: tab.text ?? "" },
                  editing: true,
                })
              }
            >
              Edit draft
            </Button>
          )
        }
      />
      {(["name", "text"] as const).map((key) => {
        const label = key === "name" ? "App name" : "Your idea";
        const Control = key === "name" ? Input : Textarea;
        const valueClass = cn(
          key === "text" ? textareaClassName : inputClassName,
          "block whitespace-pre-wrap break-words",
          key === "text" && "min-h-48",
        );
        return (
          <Field
            key={key}
            label={label}
            htmlFor={`starter-draft-${key}`}
            hint={
              key === "text"
                ? "Try: Make this idea more specific. Review the change, then save or cancel."
                : undefined
            }
          >
            {tab.editing ? (
              <Control
                name={key}
                id={`starter-draft-${key}`}
                value={tab[key] ?? ""}
                className={valueClass}
                maxLength={2000}
                onChange={(event) => {
                  guideWindows.update(tab.id, { [key]: event.target.value, dirty: true });
                }}
              />
            ) : (
              <output id={`starter-draft-${key}`} className={valueClass}>
                {tab[key] || "Not set"}
              </output>
            )}
          </Field>
        );
      })}
      <p role="status" className="text-xs text-muted-foreground">
        {tab.dirty
          ? "Unsaved changes · review, then save or cancel"
          : "Draft kept in memory for this browser session"}
      </p>
    </FormLayout>
  );
}
