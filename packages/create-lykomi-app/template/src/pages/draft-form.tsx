import {
  Button,
  Field,
  FormHeader,
  FormLayout,
  Input,
  ReadOnlyField,
  Textarea,
} from "@lykomi/web-primitives";
import { guideWindows, type GuideWindow } from "./guide-windows.ts";

/** Values belong to the app; the same fields serve manual and agent edits. */
export function DraftForm({ tab }: { tab: GuideWindow }) {
  const track = (key: "name" | "text", input: HTMLInputElement | HTMLTextAreaElement) => {
    const field = { key, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 };
    const current = guideWindows.get().tabs.find((entry) => entry.id === tab.id)?.field;
    if (JSON.stringify(current) !== JSON.stringify(field)) guideWindows.update(tab.id, { field });
  };
  return (
    <FormLayout className="mt-4">
      <FormHeader
        title="Working draft"
        level={1}
        description="Describe your app. Select a field, then ask the agent to help with it. Changes stay in this browser session; no storage service is connected."
        actions={
          tab.editing ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  guideWindows.update(tab.id, {
                    ...tab.saved,
                    editing: false,
                    dirty: false,
                    field: undefined,
                  })
                }
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  guideWindows.update(tab.id, {
                    saved: undefined,
                    editing: false,
                    dirty: false,
                    field: undefined,
                  })
                }
              >
                Save draft
              </Button>
            </>
          ) : (
            <Button
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
        return tab.editing ? (
          <Field
            key={key}
            label={label}
            hint={
              key === "text"
                ? "Try: Make this idea more specific. Review the change, then save or cancel."
                : undefined
            }
          >
            <Control
              id={`starter-draft-${key}`}
              value={tab[key] ?? ""}
              className={key === "text" ? "min-h-48" : undefined}
              maxLength={2000}
              onFocus={(event) => track(key, event.currentTarget)}
              onSelect={(event) => track(key, event.currentTarget)}
              onChange={(event) => {
                guideWindows.update(tab.id, { [key]: event.target.value, dirty: true });
                track(key, event.currentTarget);
              }}
            />
          </Field>
        ) : (
          <ReadOnlyField key={key} label={label} multiline={key === "text"}>
            {tab[key]}
          </ReadOnlyField>
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
