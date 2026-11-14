import { usePageTools } from "@lykomi/web-ui";
import { useWindows } from "@lykomi/web-ui/windows";
import { guideWindows } from "./guide-windows.ts";

/** App-owned draft updates. Field focus/value/selection context comes from the framework. */
export function useDraftTools() {
  const { tabs, active } = useWindows(guideWindows);
  const tab = tabs.find((entry) => entry.id === active);
  usePageTools(
    tab?.kind === "draft" && tab.editing
      ? [
          {
            name: "page_update_draft_field",
            description:
              "Update one field in the active Working draft when the user asks. Use its current value from context as expectedValue. Changes remain unsaved for the user to review. Never claim to save or publish.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                field: { type: "string", enum: ["name", "text"] },
                expectedValue: { type: "string" },
                value: { type: "string", maxLength: 2000 },
              },
              required: ["field", "expectedValue", "value"],
            },
            execute: async (argsJson: string) => {
              const state = guideWindows.get();
              const current = state.tabs.find((entry) => entry.id === state.active);
              const args = JSON.parse(argsJson) as Record<string, unknown>;
              if (current?.kind !== "draft" || !current.editing)
                return JSON.stringify({ error: "The draft is no longer open for editing." });
              if (
                (args.field !== "name" && args.field !== "text") ||
                typeof args.value !== "string" ||
                args.value.length > 2000
              )
                return JSON.stringify({
                  error: "Choose name or text and a string of at most 2000 characters.",
                });
              if (current[args.field] !== args.expectedValue)
                return JSON.stringify({
                  error: "The field changed. Read the current context before retrying.",
                });
              guideWindows.update(current.id, {
                [args.field]: args.value,
                dirty: true,
              });
              return JSON.stringify({
                status: "updated",
                field: args.field,
                value: args.value,
                saved: false,
              });
            },
          },
        ]
      : [],
  );
}
