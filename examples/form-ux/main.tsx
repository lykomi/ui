import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Field,
  FormActions,
  FormHeader,
  FormLayout,
  FormSection,
  Input,
  ReadOnlyField,
  Textarea,
} from "../../packages/web-primitives/src/index.ts";
import { SurfaceCard } from "../../packages/web-ui/src/components/surface-card.tsx";
import "./styles.css";

const initial = {
  name: "Alex Morgan",
  email: "alex@example.com",
  notes: "Keep labels, sections and actions consistent across generated forms.",
};

function Demo() {
  const [dark, setDark] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState("");
  const edit = editing && canEdit;
  return (
    <main
      className={`${dark ? "dark" : ""} min-h-screen bg-background p-6 text-foreground sm:p-10`}
    >
      <div className="mx-auto max-w-2xl">
        <SurfaceCard radius="md" padding="lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!edit) return;
              setSaved(draft);
              setEditing(false);
              setMessage("Contact details saved for this demo.");
            }}
          >
            <FormLayout>
              <FormHeader
                level={1}
                title="Contact details"
                description={
                  canEdit
                    ? "Contact information for your team."
                    : "Read-only access. You can read and copy these details."
                }
                actions={
                  <FormActions>
                    <Button type="button" variant="outline" onClick={() => setDark(!dark)}>
                      {dark ? "Light theme" : "Dark theme"}
                    </Button>
                    {canEdit && !edit && (
                      <Button
                        type="button"
                        onClick={() => {
                          setDraft(saved);
                          setEditing(true);
                          setMessage("");
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </FormActions>
                }
              />
              <FormSection level={2} title="Contact" description="Use your work contact details.">
                {edit ? (
                  <Field label="Full name" hint="The name your team will see.">
                    <Input
                      name="name"
                      required
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      autoComplete="name"
                    />
                  </Field>
                ) : (
                  <ReadOnlyField label="Full name" hint="The name your team will see.">
                    {saved.name}
                  </ReadOnlyField>
                )}
                {edit ? (
                  <Field label="Email" hint="We use this for updates.">
                    <Input
                      name="email"
                      type="email"
                      required
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      autoComplete="email"
                    />
                  </Field>
                ) : (
                  <ReadOnlyField label="Email" hint="We use this for updates.">
                    <a href={`mailto:${saved.email}`}>{saved.email}</a>
                  </ReadOnlyField>
                )}
              </FormSection>
              <FormSection
                level={2}
                title="Additional details"
                description="Share any context that will help your team."
              >
                {edit ? (
                  <Field label="Notes">
                    <Textarea
                      name="notes"
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    />
                  </Field>
                ) : (
                  <ReadOnlyField label="Notes" multiline>
                    {saved.notes}
                  </ReadOnlyField>
                )}
              </FormSection>
              {message && (
                <p role="status" className="text-sm text-muted-foreground">
                  {message}
                </p>
              )}
              {edit && (
                <FormActions className="justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraft(saved);
                      setEditing(false);
                      setMessage("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </FormActions>
              )}
            </FormLayout>
          </form>
        </SurfaceCard>
        <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!canEdit}
              disabled={editing}
              onChange={(e) => setCanEdit(!e.target.checked)}
            />
            Preview read-only access
          </label>
          <p>
            {editing
              ? "Save or cancel before switching the preview's access mode."
              : "This preview simulates access; your application must enforce real permissions."}
          </p>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
