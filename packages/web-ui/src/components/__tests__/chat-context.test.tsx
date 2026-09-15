import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useAppStore } from "../../lib/app-store.ts";
import { TooltipProvider } from "../../ui/tooltip.tsx";
import { ChatContext } from "../chat-context.tsx";

let root: Root;
let container: HTMLDivElement;
let previousActEnvironment: boolean | undefined;

beforeEach(() => {
  previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useAppStore.setState({
    currentPage: "/tasks",
    navContext: { ...useAppStore.getInitialState().navContext, label: "Activity" },
    contextItems: [],
    sentContext: {},
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useAppStore.setState(useAppStore.getInitialState());
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

function render() {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/tasks?workspace=space-a"]}>
        <TooltipProvider>
          <ChatContext />
        </TooltipProvider>
      </MemoryRouter>,
    ),
  );
}
function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.getAttribute("aria-label") === label || item.textContent === label,
  );
  expect(button, `button ${label}`).toBeDefined();
  act(() => button!.click());
}
function openContext() {
  act(() => container.querySelector<HTMLButtonElement>("[data-chat-context]")!.click());
}

it("keeps navigation and all added references behind one With entry point", () => {
  useAppStore.getState().addContextItem({
    type: "ref",
    label: "Contract clause",
    persistence: "ephemeral",
    sourcePage: "/document#clause",
    payload: { kind: "ref", refType: "block", refId: "clause", preview: "Payment terms" },
  });
  render();
  expect(container.textContent).toContain("With Activity");
  expect(container.textContent).toContain("+1");
  expect(container.textContent).not.toContain("Contract clause");
  openContext();
  expect(document.querySelector('[aria-label="Added context"]')?.textContent).toContain(
    "Contract clause",
  );
  click("Pin Contract clause");
  expect(useAppStore.getState().contextItems[0].persistence).toBe("persistent");
  expect(document.querySelector('[aria-label="Added context"]')?.textContent).toContain("Pinned");
  click("Remove Contract clause");
  expect(useAppStore.getState().contextItems).toHaveLength(0);
  expect(container.textContent).not.toContain("+1");
});

it("updates the With selection and preserves its request and sent-message context", () => {
  const item = {
    type: "note" as const,
    label: "1 activity item selected",
    persistence: "ephemeral" as const,
    sourcePage: "/tasks",
    payload: { kind: "text" as const, text: "Selected run details" },
  };
  useAppStore.getState().setContextItem("activity-selection", item);
  render();
  expect(container.textContent).toContain("1 activity item selected");
  expect(useAppStore.getState().getAgentState().contextItems[0]).toMatchObject({
    text: "Selected run details",
  });
  act(() => useAppStore.getState().consumeContextForMessage("message-1"));
  expect(useAppStore.getState().contextItems[0].key).toBe("activity-selection");
  act(() => useAppStore.getState().setContextItem("activity-selection", null));
  expect(container.textContent).not.toContain("1 activity item selected");
  expect(useAppStore.getState().sentContext["message-1"][0].payload).toEqual(item.payload);
});

it("pins the scoped page and keeps it after navigation until removed", () => {
  useAppStore.setState({ currentPage: "/tasks?workspace=space-a" });
  render();
  openContext();
  click("Keep this page in context");
  expect(useAppStore.getState().contextItems[0]).toMatchObject({
    persistence: "persistent",
    payload: { path: "/tasks?workspace=space-a", label: "Activity" },
  });
  act(() => useAppStore.getState().setCurrentPage("/document"));
  expect(useAppStore.getState().contextItems).toHaveLength(1);
  click("Remove Activity");
  expect(useAppStore.getState().contextItems).toHaveLength(0);
});

it("uses canonical page identity instead of adding URL query parameters", () => {
  useAppStore.setState({ currentPage: "/tasks" });
  render();
  openContext();
  click("Keep this page in context");
  expect(useAppStore.getState().contextItems[0].payload).toMatchObject({ path: "/tasks" });
});
