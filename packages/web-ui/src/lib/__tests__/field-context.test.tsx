import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
let root: Root | null, host: HTMLDivElement;
const fireEvent = {
  select: (element: HTMLElement) => element.dispatchEvent(new Event("select", { bubbles: true })),
  pointerDown: (element: HTMLElement) =>
    element.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  focusIn: (element: HTMLElement) =>
    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
};
const screen = {
  getByLabelText: (text: string) => {
    const label = [...host.querySelectorAll("label")].find(
      (node) => node.textContent?.trim() === text,
    );
    const control = label?.htmlFor
      ? document.getElementById(label.htmlFor)
      : label?.querySelector("input, textarea, select");
    return (control ??
      [...host.querySelectorAll<HTMLElement>("[aria-label]")].find(
        (node) => node.getAttribute("aria-label") === text,
      )) as HTMLElement;
  },
  getByText: (text: string) =>
    [...host.querySelectorAll<HTMLElement>("*")].find((node) => node.textContent?.trim() === text)!,
};
function cleanup() {
  if (root) act(() => root!.unmount());
  root = null;
  host.remove();
}
function render(children: ReactNode) {
  act(() => root!.render(children));
  return { container: host, unmount: cleanup };
}
import { Field, Input, ReadOnlyField, Textarea } from "@lykomi/web-primitives";
import { useAppStore } from "../app-store.ts";
import {
  clearActiveFieldContext,
  getActiveFieldContext,
  registerFieldContextSource,
} from "../field-context-tracking.ts";

const items = () => useAppStore.getState().getAgentState().contextItems;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  clearActiveFieldContext();
  useAppStore.getState().resetAll();
});
afterEach(cleanup);

describe("automatic framework field context", () => {
  it("reads label, live value and selection without application event handlers", () => {
    render(
      <>
        <Field label="Your idea">
          <Textarea name="idea" defaultValue="Alpha beta gamma" />
        </Field>
        <textarea aria-label="Chat" />
      </>,
    );
    const input = screen.getByLabelText("Your idea") as HTMLTextAreaElement;
    input.focus();
    input.setSelectionRange(6, 10);
    fireEvent.select(input);
    screen.getByLabelText("Chat").focus();
    expect(items()).toEqual([
      expect.objectContaining({
        refType: "form-field",
        target: expect.objectContaining({
          path: "idea",
          label: "Your idea",
          currentValue: "Alpha beta gamma",
        }),
        meta: expect.objectContaining({
          fieldFocus: "active",
          caret: expect.objectContaining({ selectedText: "beta" }),
        }),
      }),
    ]);
    input.value = "New value from outside React";
    expect(items()[0].target).toMatchObject({ currentValue: "New value from outside React" });
    expect((items()[0].meta as Record<string, unknown>).caret).toBeNull();
  });

  it("uses the same field snapshot for the sent message and clears it on navigation", () => {
    render(
      <Field label="Idea">
        <Input name="idea" defaultValue="Visible draft" />
      </Field>,
    );
    screen.getByLabelText("Idea").focus();
    const sent = useAppStore.getState().consumeContextForMessage("message-1");
    expect(sent[0].payload).toMatchObject({ target: { currentValue: "Visible draft" } });
    expect(items()).toHaveLength(1);
    useAppStore.getState().setCurrentPage("/different");
    expect(items()).toEqual([]);
    expect(sent[0].payload).toMatchObject({ target: { currentValue: "Visible draft" } });
  });

  it("switches to one active field and handles read-only, boolean and select values", () => {
    render(
      <>
        <Field label="Enabled">
          <input type="checkbox" defaultChecked />
        </Field>
        <Field label="Phase">
          <select defaultValue="draft">
            <option value="draft">Draft</option>
          </select>
        </Field>
        <ReadOnlyField label="Summary">A short idea</ReadOnlyField>
      </>,
    );
    screen.getByLabelText("Enabled").focus();
    expect(items()[0].target).toMatchObject({ currentValue: true });
    screen.getByLabelText("Phase").focus();
    expect(items()).toHaveLength(1);
    expect(items()[0].target).toMatchObject({ label: "Phase", currentValue: "draft" });
    fireEvent.pointerDown(screen.getByText("A short idea"));
    expect(items()[0].target).toMatchObject({ label: "Summary", currentValue: "A short idea" });
  });

  it("never collects password, opted-out or hidden fields", () => {
    const view = render(
      <>
        <Field label="Public">
          <Input defaultValue="Public value" />
        </Field>
        <Field label="Password">
          <Input type="password" defaultValue="private" />
        </Field>
        <Field label="Private" agentContext={false}>
          <Input defaultValue="secret" />
        </Field>
      </>,
    );
    screen.getByLabelText("Public").focus();
    expect(items()).toHaveLength(1);
    screen.getByLabelText("Password").focus();
    expect(items()).toEqual([]);
    screen.getByLabelText("Private").focus();
    expect(items()).toEqual([]);
    screen.getByLabelText("Public").focus();
    view.container.style.display = "none";
    expect(items()).toEqual([]);
    view.container.style.display = "";
    expect(items()).toEqual([]);
  });

  it("retains context across the mobile chat switch but drops closed or inactive windows", () => {
    const view = render(
      <div data-working-content>
        <section data-item-tab="draft" data-window-active="true">
          <Field label="Idea">
            <Textarea defaultValue="Keep me" />
          </Field>
        </section>
      </div>,
    );
    screen.getByLabelText("Idea").focus();
    const content = view.container.firstElementChild!;
    content.setAttribute("inert", "");
    content.setAttribute("aria-hidden", "true");
    expect(items()[0].target).toMatchObject({ currentValue: "Keep me" });
    content.firstElementChild!.setAttribute("data-window-active", "false");
    expect(items()).toEqual([]);
    content.removeAttribute("inert");
    content.removeAttribute("aria-hidden");
    content.firstElementChild!.setAttribute("data-window-active", "true");
    screen.getByLabelText("Idea").focus();
    fireEvent.focusIn(screen.getByLabelText("Idea"));
    view.unmount();
    expect(items()).toEqual([]);
  });

  it("lets a domain source own nested primitives without duplicating their context", () => {
    const unregister = registerFieldContextSource("test-domain", {
      selector: "[data-record-field]",
      getRefId: () => "record:idea",
      ignoreSelector: "[data-review-action]",
    });
    render(
      <div data-record-field>
        <Field label="Idea">
          <Textarea defaultValue="Domain value" />
        </Field>
        <button data-review-action>Accept</button>
      </div>,
    );
    const input = screen.getByLabelText("Idea") as HTMLTextAreaElement;
    input.focus();
    input.setSelectionRange(0, 6);
    fireEvent.select(input);
    expect(items()).toEqual([]);
    expect(getActiveFieldContext()).toMatchObject({
      refId: "record:idea",
      source: "test-domain",
      caret: { start: 0, end: 6 },
    });
    screen.getByText("Accept").focus();
    expect(getActiveFieldContext()?.target).toBe(input);
    unregister();
    expect(getActiveFieldContext()).toBeNull();
  });
});
