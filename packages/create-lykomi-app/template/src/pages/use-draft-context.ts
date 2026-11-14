import { useEffect } from "react";
import { useAppStore, usePageTools } from "@lykomi/web-ui";
import { useWindows } from "@lykomi/web-ui/windows";
import { guideWindows } from "./guide-windows.ts";

/** Only the active window contributes a field; moving into chat retains it. */
export function useDraftContext() {
  const { tabs, active } = useWindows(guideWindows);
  const tab = tabs.find((entry) => entry.id === active);
  useEffect(() => {
    const field = tab?.kind === "draft" && tab.editing ? tab.field : undefined;
    const value = field ? (tab?.[field.key] ?? "") : "";
    const label = field?.key === "name" ? "App name" : "Your idea";
    useAppStore.getState().setContextItem(
      "starter:active-field",
      field
        ? {
            type: "ref",
            label,
            sourcePage: "/guide",
            persistence: "ephemeral",
            payload: {
              kind: "ref",
              refType: "form-field",
              refId: `draft:${field.key}`,
              target: {
                kind: "field",
                path: field.key,
                label,
                containerId: "draft",
                containerLabel: "Working draft",
                currentValue: value,
              },
              meta: {
                fieldFocus: "active",
                fieldLabel: label,
                caret: {
                  start: field.start,
                  end: field.end,
                  selectedText: value.slice(field.start, field.end),
                },
              },
            },
          }
        : null,
    );
    return () => useAppStore.getState().setContextItem("starter:active-field", null);
  }, [tab]);

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
                field: { key: args.field, start: 0, end: 0 },
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
