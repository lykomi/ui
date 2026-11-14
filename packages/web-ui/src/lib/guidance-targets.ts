import { isFieldContextVisible } from "./field-context-tracking.ts";

export interface GuidanceTargetSource {
  selector: string;
  label: (element: HTMLElement) => string;
  contextRefId?: (element: HTMLElement) => string | undefined;
}

export interface GuidanceTarget {
  targetId: string;
  label: string;
  kind: "field" | "action";
  contextRefId?: string;
  required: boolean;
  disabled: boolean;
  invalid: boolean;
}

const sources = new Map<string, GuidanceTargetSource>();
const privateSelector = "[data-agent-context='off'], [data-guidance-ignore]";

/** Applications contribute semantic boundaries; model arguments never become selectors. */
export function registerGuidanceSource(name: string, source: GuidanceTargetSource) {
  sources.set(name, source);
  return () => {
    if (sources.get(name) === source) sources.delete(name);
  };
}

export function isGuidanceTargetAvailable(element: HTMLElement): boolean {
  return (
    isFieldContextVisible(element) &&
    !element.closest(privateSelector) &&
    !element.closest('[data-item-tab][data-window-active="false"]') &&
    !element.matches("input[type='password'], input[type='file']") &&
    !element.querySelector("input[type='password'], input[type='file']") &&
    element.getClientRects().length > 0
  );
}

export function guidanceViewKey(): string {
  const windows = [...document.querySelectorAll<HTMLElement>("[data-item-tab]")]
    .filter((node) => node.dataset.windowActive !== "false" && isFieldContextVisible(node))
    .map((node) => node.dataset.itemTab)
    .join("|");
  return `${window.location.href}:${windows}`;
}

function fieldLabel(element: HTMLElement): string {
  const label = element.querySelector("[data-agent-field-label], label")?.cloneNode(true) as
    HTMLElement | undefined;
  label?.querySelectorAll("[aria-hidden='true']").forEach((node) => node.remove());
  return label?.textContent?.trim() || element.getAttribute("aria-label") || "";
}

function controlLabel(element: HTMLElement): string {
  const labelledBy = element
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const labels = "labels" in element ? (element as HTMLInputElement).labels : null;
  return (
    element.getAttribute("aria-label") ||
    labelledBy ||
    (labels ? [...labels].map((label) => label.textContent?.trim()).join(" ") : "") ||
    element.getAttribute("data-guidance-target") ||
    element.getAttribute("title") ||
    (element.matches("input, textarea, [role='textbox']")
      ? element.getAttribute("placeholder") || element.getAttribute("name")
      : element.textContent?.trim()) ||
    ""
  );
}

/** Bounded labels/capabilities only. Values stay in the existing field-context projection. */
export function collectGuidanceTargets() {
  const elements = new Map<HTMLElement, { label: string; contextRefId?: string }>();
  for (const source of sources.values()) {
    for (const element of document.querySelectorAll<HTMLElement>(source.selector)) {
      elements.set(element, {
        label: source.label(element),
        contextRefId: source.contextRefId?.(element),
      });
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-agent-field]")) {
    if ([...elements.keys()].some((parent) => parent.contains(element))) continue;
    elements.set(element, { label: fieldLabel(element) });
  }
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      "button, a[href], input, textarea, select, [role='button'], [role='tab'], [role='textbox'], [role='combobox'], [role='checkbox'], [role='switch'], [role='slider'], [data-guidance-target]",
    ),
  ];
  const priority = (node: HTMLElement) =>
    node.closest("[data-working-content], [role='dialog']")
      ? 0
      : node.matches("textarea, [role='textbox'], [data-guidance-target]")
        ? 1
        : 2;
  controls.sort((a, b) => priority(a) - priority(b));
  for (const element of controls) {
    if ([...elements.keys()].some((parent) => parent.contains(element))) continue;
    elements.set(element, {
      label: controlLabel(element),
    });
  }
  const result: Array<{ target: Omit<GuidanceTarget, "targetId">; element: HTMLElement }> = [];
  for (const [element, meta] of elements) {
    if (!meta.label || !isGuidanceTargetAvailable(element)) continue;
    const control = element.matches("button, a[href], input, select, textarea, [role]")
      ? element
      : element.querySelector<HTMLElement>("input, select, textarea, [role='combobox']");
    result.push({
      element,
      target: {
        label: meta.label.slice(0, 160),
        contextRefId: meta.contextRefId,
        kind: element.matches("button, a[href], [role='button'], [role='tab']")
          ? "action"
          : "field",
        required: !!control?.matches("[required], [aria-required='true']"),
        disabled: !!control?.matches(":disabled, [aria-disabled='true']"),
        invalid: !!control?.matches("[aria-invalid='true']"),
      },
    });
    if (result.length === 80) break;
  }
  return result;
}
