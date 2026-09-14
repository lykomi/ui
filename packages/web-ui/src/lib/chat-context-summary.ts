import type { AgentStateProjection } from "./app-store.ts";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Describe the request projection, including context supplied by modules. */
export function summarizeChatContext(state: AgentStateProjection) {
  const nav = state.navigation;
  const focused = record(nav.meta.focusedSurface);
  const references = state.contextItems.map(
    (item): Record<string, unknown> & { meta: Record<string, unknown> } => {
      const payload = record(item.payload);
      return { ...item, ...payload, meta: { ...record(item.meta), ...record(payload.meta) } };
    },
  );
  const field = references.find((item) => item.meta.fieldFocus === "active");
  const component = references.find((item) => item.meta.componentFocus === "active");
  const selected = references.find(
    (item) => item.type === "selection" || item.meta.selectionScope === "text",
  );
  const target = field && record(field.target ?? field.meta.jsonTarget);
  const detail = selected
    ? "Selected text"
    : field
      ? text(target?.label) || text(field.meta.fieldLabel) || text(field.label)
      : component
        ? text(component.meta.componentLabel) || text(component.label)
        : "";
  const pageLabel =
    nav.label && !nav.label.startsWith("/") && !/^\/?chat$/i.test(nav.label)
      ? nav.label
      : "Your spaces";
  const label = text(focused.title) || pageLabel;
  const open = references.filter((item) => item.meta.windowState === "open");
  return {
    label,
    detail: detail === label ? "" : detail,
    focused: Boolean(focused.title),
    path: nav.page,
    field: Boolean(field),
    selectedText: text(selected?.text) || text(record(field?.meta.caret).selectedText),
    references: open.map((item) => text(item.label)).filter(Boolean),
  };
}
