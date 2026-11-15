import { useLayoutEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  FormHeader,
  FormLayout,
  Input,
  Textarea,
  cn,
  inputClassName,
  textareaClassName,
} from "@lykomi/web-primitives";
import { usePageTools } from "@lykomi/web-ui";
import {
  initialProject,
  projectErrors,
  applyProjectEdit,
  type ProjectDraft,
} from "./form-model.ts";

export function FormExample() {
  const [saved, setSaved] = useState(initialProject);
  const [draft, setDraft] = useState(initialProject);
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("Local example · nothing is sent or saved to a server.");
  const editButton = useRef<HTMLButtonElement>(null);
  const current = useRef({ draft, editing });
  useLayoutEffect(() => {
    current.current = { draft, editing };
  }, [draft, editing]);
  const dirty = draft.name !== saved.name || draft.brief !== saved.brief;
  const errors = projectErrors(draft);
  const finish = (save: boolean) => {
    if (save && (errors.name || errors.brief)) {
      setSubmitted(true);
      return;
    }
    if (save) setSaved(draft);
    else setDraft(saved);
    setEditing(false);
    setSubmitted(false);
    setMessage(
      save
        ? "Saved in this example only. Reloading or leaving the example resets it."
        : "Changes discarded. Your last local save is restored.",
    );
    requestAnimationFrame(() => editButton.current?.focus());
  };
  usePageTools(
    editing
      ? [
          {
            name: "page_update_project_field",
            description:
              "Edit the selected project's name or brief when asked. Use the live field value as expectedValue. Changes remain unsaved for the user; this tool cannot save or publish.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                field: { type: "string", enum: ["name", "brief"] },
                expectedValue: { type: "string" },
                value: { type: "string", maxLength: 2000 },
              },
              required: ["field", "expectedValue", "value"],
            },
            execute: async (json) => {
              let args: unknown;
              try {
                args = JSON.parse(json);
              } catch {
                return JSON.stringify({ error: "Invalid JSON." });
              }
              const result = applyProjectEdit(current.current.draft, current.current.editing, args);
              if (!result.draft) return JSON.stringify(result);
              current.current = { ...current.current, draft: result.draft };
              setDraft(result.draft);
              return JSON.stringify({ status: "updated", saved: false });
            },
          },
        ]
      : [],
  );
  const fields: Array<{ key: keyof ProjectDraft; label: string; hint: string }> = [
    { key: "name", label: "Project name", hint: "A clear name for the work ahead." },
    {
      key: "brief",
      label: "Project brief",
      hint: "Select a few words, then look at the live context or ask your agent to improve them.",
    },
  ];
  return (
    <FormLayout
      onKeyDown={(event) => {
        if (event.key === "Escape" && editing) {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
    >
      <FormHeader
        title="Project details"
        description="Read first. Edit deliberately. Keep the agent and the person working on the same draft."
        actions={
          editing ? (
            <>
              <Button variant="outline" onClick={() => finish(false)}>
                Cancel changes
              </Button>
              <Button onClick={() => finish(true)}>Save project</Button>
            </>
          ) : (
            <Button
              ref={editButton}
              onClick={() => {
                setEditing(true);
                setSubmitted(false);
              }}
            >
              Edit project
            </Button>
          )
        }
      />
      {fields.map(({ key, label, hint }) => {
        const Control = key === "brief" ? Textarea : Input;
        const slot = cn(
          key === "brief" ? textareaClassName : inputClassName,
          "block whitespace-pre-wrap break-words",
          key === "brief" && "min-h-36",
        );
        return (
          <Field
            key={key}
            label={label}
            hint={hint}
            htmlFor={`showcase-${key}`}
            error={submitted ? errors[key] : undefined}
          >
            {editing ? (
              <Control
                name={key}
                id={`showcase-${key}`}
                required
                value={draft[key]}
                className={slot}
                maxLength={key === "name" ? 80 : 2000}
                onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}
              />
            ) : (
              <output id={`showcase-${key}`} name={key} className={slot}>
                {draft[key]}
              </output>
            )}
          </Field>
        );
      })}
      <Field
        label="Internal note"
        hint="Excluded from agent context with agentContext={false}."
        agentContext={false}
      >
        <Input name="internalNote" defaultValue="Private demo note" readOnly />
      </Field>
      <p role="status" className="text-xs leading-relaxed text-muted-foreground">
        {dirty ? "Unsaved changes · review, then save or cancel." : message}
      </p>
    </FormLayout>
  );
}
