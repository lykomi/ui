/** One focus/caret owner for native fields and application-defined surfaces. */
export interface FieldContextSource {
  selector: string;
  getRefId: (element: HTMLElement) => string | null;
  ignoreSelector?: string;
}
export interface ActiveFieldContext {
  refId: string | null;
  element: HTMLElement;
  target: HTMLElement;
  source: string;
  caret: { start: number; end: number; direction: string; value: string } | null;
}

const sources = new Map<string, FieldContextSource>();
let active: ActiveFieldContext | null = null;
let installedDocument: Document | null = null;
const privateSelector =
  "[data-agent-context='off'], input[type='password'], input[type='file'], input[type='hidden']";

export function isFieldContextVisible(element: HTMLElement, keepForChat = false): boolean {
  if (
    !element.isConnected ||
    element.closest("[data-agent-context='off']") ||
    element.querySelector("input[type='password'], [data-agent-context='off']")
  )
    return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    // Mobile chat hides the outer work pane, not the user's current subject.
    if (keepForChat && node.matches("[data-working-content]")) continue;
    const style = getComputedStyle(node);
    if (
      node.hidden ||
      node.hasAttribute("inert") ||
      node.getAttribute("aria-hidden") === "true" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.contentVisibility === "hidden"
    )
      return false;
  }
  return true;
}

export function registerFieldContextSource(id: string, source: FieldContextSource) {
  sources.set(id, source);
  installFieldContextTracking();
  return () => {
    if (sources.get(id) !== source) return;
    sources.delete(id);
    if (active?.source === id) clearActiveFieldContext();
  };
}

function resolve(target: HTMLElement) {
  // Domain boundaries take precedence over leaf Fields inside them.
  for (const [source, options] of [...sources].reverse()) {
    const element = target.closest<HTMLElement>(options.selector);
    if (element) return { source, options, element };
  }
  const element = target.closest<HTMLElement>("[data-agent-field]");
  return element
    ? {
        source: "field",
        element,
        options: {
          getRefId: (host: HTMLElement) => host.dataset.agentField ?? null,
          ignoreSelector: undefined,
        },
      }
    : null;
}

export function clearActiveFieldContext() {
  active?.element.removeAttribute("data-agent-selected");
  active = null;
}

export function getActiveFieldContext(): ActiveFieldContext | null {
  if (
    active &&
    (!isFieldContextVisible(active.element, true) ||
      active.element.closest('[data-item-tab][data-window-active="false"]'))
  )
    clearActiveFieldContext();
  return active;
}

function trackFocus(event: Event) {
  if (!(event.target instanceof HTMLElement)) return;
  const target = event.target;
  if (target.closest(privateSelector)) {
    clearActiveFieldContext();
    return;
  }
  const owner = resolve(target);
  if (!owner || (owner.options.ignoreSelector && target.closest(owner.options.ignoreSelector)))
    return;
  if (!isFieldContextVisible(owner.element)) return;
  const refId = owner.options.getRefId(owner.element);
  const caret = active?.element === owner.element ? active.caret : null;
  for (const node of document.querySelectorAll("[data-agent-selected]"))
    node.removeAttribute("data-agent-selected");
  owner.element.setAttribute("data-agent-selected", "true");
  active = { refId, element: owner.element, target, source: owner.source, caret };
}

function trackCaret(event: Event) {
  const target = event.type === "selectionchange" ? document.activeElement : event.target;
  if (!(target instanceof HTMLElement) || target.closest(privateSelector)) return;
  const owner = resolve(target);
  if (
    !owner ||
    !isFieldContextVisible(owner.element) ||
    (owner.options.ignoreSelector && target.closest(owner.options.ignoreSelector))
  )
    return;
  let caret: ActiveFieldContext["caret"] = null;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target.selectionStart === null || target.selectionEnd === null) return;
    caret = {
      start: target.selectionStart,
      end: target.selectionEnd,
      direction: target.selectionDirection || "none",
      value: target.value,
    };
  } else if (target.isContentEditable) {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !selection.focusNode ||
      !target.contains(selection.anchorNode) ||
      !target.contains(selection.focusNode)
    )
      return;
    const offset = (node: Node, end: number) => {
      const range = document.createRange();
      range.selectNodeContents(target);
      range.setEnd(node, end);
      return range.toString().length;
    };
    const start = offset(selection.anchorNode, selection.anchorOffset),
      end = offset(selection.focusNode, selection.focusOffset);
    caret = {
      start: Math.min(start, end),
      end: Math.max(start, end),
      direction: start > end ? "backward" : "forward",
      value: target.textContent ?? "",
    };
  }
  if (caret) {
    active = {
      refId: owner.options.getRefId(owner.element),
      element: owner.element,
      target,
      source: owner.source,
      caret,
    };
  }
}

export function installFieldContextTracking() {
  if (typeof document === "undefined" || installedDocument === document) return;
  installedDocument = document;
  document.addEventListener("focusin", trackFocus, true);
  document.addEventListener("pointerdown", trackFocus, true);
  for (const name of ["input", "select", "keyup", "pointerup", "focusin", "selectionchange"])
    document.addEventListener(name, trackCaret, true);
}
