import type { ContextItem } from "./app-store.ts";
import { getActiveFieldContext, isFieldContextVisible } from "./field-context-tracking.ts";

/** Read the selected primitive's current DOM value at request time, never a stale copy. */
export function collectFieldContextItems(sourcePage: string): ContextItem[] {
  const active = getActiveFieldContext();
  if (!active || active.source !== "field") return [];
  const host = active.element;
  if (host.querySelector("input[type='password'], input[type='file'], [data-agent-context='off']"))
    return [];
  const control = [
    ...host.querySelectorAll<HTMLElement>(
      "input:not([type='hidden']), textarea, select, [role='checkbox'], [role='switch'], [role='combobox'], [contenteditable='true'], output, [data-agent-field-value]",
    ),
  ].find(
    (node) => node.closest("[data-agent-field]") === host && isFieldContextVisible(node, true),
  );
  if (!control || control.closest("[data-agent-field]") !== host) return [];
  const labelNode = host.querySelector("[data-agent-field-label]")?.cloneNode(true) as
    HTMLElement | undefined;
  labelNode?.querySelectorAll("[aria-hidden='true']").forEach((node) => node.remove());
  const label =
    labelNode?.textContent?.trim() ||
    control.getAttribute("aria-label") ||
    control.getAttribute("name") ||
    "Field";
  let value: unknown = control.textContent ?? "";
  if (control instanceof HTMLInputElement)
    value =
      control.type === "checkbox" || control.type === "radio"
        ? control.indeterminate
          ? null
          : control.checked
        : control.value;
  else if (control instanceof HTMLTextAreaElement) value = control.value;
  else if (control instanceof HTMLSelectElement)
    value = control.multiple
      ? [...control.selectedOptions].map((option) => option.value)
      : control.value;
  else if (control.hasAttribute("aria-checked"))
    value =
      control.getAttribute("aria-checked") === "mixed"
        ? null
        : control.getAttribute("aria-checked") === "true";
  const path = control.getAttribute("name") || control.id || host.dataset.agentField!;
  const pane = host.closest<HTMLElement>("[data-item-tab]");
  const caret = active.caret && active.caret.value === value ? active.caret : null;
  return [
    {
      id: `field:${sourcePage}:${active.refId}`,
      createdAt: 0,
      type: "ref",
      label,
      sourcePage,
      persistence: "ephemeral",
      payload: {
        kind: "ref",
        refType: "form-field",
        refId: `${sourcePage}:${active.refId}`,
        target: {
          kind: "field",
          path,
          label,
          containerId: pane?.dataset.itemTab,
          containerLabel: pane?.dataset.focusTitle,
          currentValue: value,
        },
        meta: {
          fieldFocus: "active",
          fieldLabel: label,
          caret: caret
            ? {
                start: caret.start,
                end: caret.end,
                direction: caret.direction,
                selectedText: caret.value.slice(caret.start, caret.end).slice(0, 1200),
              }
            : null,
        },
      },
    },
  ];
}
