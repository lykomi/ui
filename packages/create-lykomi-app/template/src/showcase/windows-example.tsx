import { useState } from "react";
import { Button, Field, Textarea } from "@lykomi/web-primitives";
import { createWindowStore, WindowWorkbench, type WorkbenchWindow } from "@lykomi/web-ui/windows";

interface NoteWindow extends WorkbenchWindow {
  text: string;
}
export function WindowsExample() {
  const [controller] = useState(() => {
    const store = createWindowStore<NoteWindow>();
    const open = (id: string, title: string, text: string) =>
      store.open(
        {
          id,
          title,
          text,
          independent: true,
          close: () => {
            const tab = store.get().tabs.find((entry) => entry.id === id);
            if (!tab?.dirty || window.confirm("Close this note and discard your changes?"))
              store.remove(id);
          },
        },
        { mode: "new-tab" },
      );
    open("plan", "Planting plan", "Start with herbs and easy-to-grow vegetables.");
    open("notes", "Shared notes", "Ask neighbors which days they can help.");
    store.select("plan");
    return store;
  });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">One workspace, two layouts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit a note, switch to panels, pin or reorder it. The same editor stays mounted. Changes
          are local to this example.
        </p>
      </div>
      <div className="h-[30rem] min-w-0 overflow-hidden rounded-xl border border-border">
        <WindowWorkbench
          controller={controller}
          getWindowContext={(tab) => ({
            title: tab.title,
            kind: "document",
            windowId: tab.id,
            content: tab.text,
            unsavedChanges: !!tab.dirty,
          })}
          toolbar={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const id = `note-${crypto.randomUUID()}`;
                controller.open(
                  {
                    id,
                    title: "New note",
                    text: "",
                    independent: true,
                    close: () => {
                      const tab = controller.get().tabs.find((entry) => entry.id === id);
                      if (
                        !tab?.dirty ||
                        window.confirm("Close this note and discard your changes?")
                      )
                        controller.remove(id);
                    },
                  },
                  { mode: "new-tab" },
                );
              }}
            >
              New note
            </Button>
          }
          empty={
            <p className="p-6 text-sm text-muted-foreground">
              All notes are closed. Create a new note to continue.
            </p>
          }
          renderWindow={(tab) => (
            <div className="space-y-4 p-5">
              <Field label={`${tab.title} text`}>
                <Textarea
                  name="note"
                  className="min-h-44"
                  value={tab.text}
                  onChange={(event) =>
                    controller.update(tab.id, { text: event.target.value, dirty: true })
                  }
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {tab.dirty
                  ? "Unsaved note · closing asks before discarding it."
                  : "Edit this note to see live window and field context."}
              </p>
            </div>
          )}
        />
      </div>
    </div>
  );
}
