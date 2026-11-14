import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clientToolRegistry } from "@lykomi/agent";
import { useAppStore } from "../../lib/app-store.ts";
import { summarizeChatContext } from "../../lib/chat-context-summary.ts";
import { ProcessGuide, type GuidedProcessStep } from "./process-guide.tsx";
import { ChatContext } from "../chat-context.tsx";
import { processContextStore } from "./process-agent-context.ts";
let root: Root, host: HTMLDivElement;
const steps: GuidedProcessStep[] = [
  { id: "docs", label: "Documents", status: "complete", selectable: true },
  {
    id: "review",
    label: "Review",
    status: "ready",
    selectable: true,
    description: "Check findings",
  },
  { id: "confirm", label: "Confirm", status: "blocked", message: "Review first" },
];
const context = { id: "assessment", label: "Assessment", sourcePage: "/assessment", active: true };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useAppStore.getState().resetAll();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  expect(processContextStore.getState().entries.size).toBe(0);
});
function snapshot() {
  return useAppStore
    .getState()
    .getAgentState()
    .contextItems.find((item) => item.refType === "process")!;
}
function render(active = true, nextSteps = steps) {
  act(() =>
    root.render(
      <ProcessGuide
        agentContext={{ ...context, active }}
        steps={nextSteps}
        currentStepId="review"
        selectedStepId="docs"
      />,
    ),
  );
}
it("projects actual and inspected steps independently, including blocked guidance, without UI values", () => {
  render();
  const item = snapshot();
  expect(item.meta).toMatchObject({
    process: {
      currentStepId: "review",
      selectedStepId: "docs",
      steps: [
        { id: "docs" },
        { description: "Check findings" },
        { status: "blocked", message: "Review first" },
      ],
    },
  });
  expect(summarizeChatContext(useAppStore.getState().getAgentState()).detail).toBe(
    "Assessment › Documents",
  );
  expect(() => structuredClone(item)).not.toThrow();
  const updated = steps.map((s) =>
    s.id === "review"
      ? { ...s, status: "running" as const, content: <input />, description: <b>Rendering only</b> }
      : s,
  );
  render(true, updated);
  expect(JSON.stringify(snapshot())).toContain('"status":"running"');
  expect(JSON.stringify(snapshot())).not.toContain("Rendering only");
});
it("excludes inactive guides and removes their context on unmount, independently of pinned context capacity", () => {
  for (let i = 0; i < 10; i++)
    useAppStore.getState().addContextItem({
      type: "note",
      label: `Pin ${i}`,
      payload: { kind: "text", text: "Pinned" },
      sourcePage: "/pins",
      persistence: "persistent",
    });
  render();
  expect(snapshot()).toBeDefined();
  render(false);
  expect(snapshot()).toBeUndefined();
  expect(useAppStore.getState().contextItems.length).toBe(10);
});
it("retains the exact sent process snapshot while later turns use live status", () => {
  render();
  useAppStore.getState().consumeContextForMessage("message");
  render(
    true,
    steps.map((s) => (s.id === "review" ? { ...s, status: "complete" as const } : s)),
  );
  expect(JSON.stringify(useAppStore.getState().sentContext.message)).toContain('"status":"ready"');
  expect(JSON.stringify(snapshot())).toContain('"status":"complete"');
});
it("uses the same host callback to select and unfold without advancing or executing work", async () => {
  function Guide() {
    const [selected, setSelected] = useState("review");
    return (
      <ProcessGuide
        agentContext={context}
        steps={steps}
        currentStepId="review"
        selectedStepId={selected}
        onStepSelect={setSelected}
        guidance="collapsible"
        guidanceTogglePlacement="step"
      />
    );
  }
  act(() => root.render(<Guide />));
  await act(async () => {
    const result = await clientToolRegistry
      .getState()
      .executeTool(
        "ui_process_select_step",
        JSON.stringify({ processId: "assessment", sourcePage: "/assessment", stepId: "docs" }),
      );
    expect(JSON.parse(result).status).toBe("requested");
  });
  expect(host.querySelector('[aria-expanded="true"]')).not.toBeNull();
  expect(snapshot().meta).toMatchObject({
    process: { currentStepId: "review", selectedStepId: "docs" },
  });
  const result = await clientToolRegistry
    .getState()
    .executeTool(
      "ui_process_select_step",
      JSON.stringify({ processId: "assessment", sourcePage: "/assessment", stepId: "confirm" }),
    );
  expect(JSON.parse(result).status).toBe("error");
});
it("rejects stale, malformed and ambiguous tool targets and reads current host callbacks", async () => {
  const select = vi.fn();
  act(() =>
    root.render(
      <ProcessGuide
        agentContext={context}
        steps={steps}
        currentStepId="review"
        onStepSelect={select}
      />,
    ),
  );
  const newer = vi.fn();
  act(() =>
    root.render(
      <ProcessGuide
        agentContext={context}
        steps={steps}
        currentStepId="review"
        onStepSelect={newer}
      />,
    ),
  );
  const args = JSON.stringify({
    processId: "assessment",
    sourcePage: "/assessment",
    stepId: "docs",
  });
  await clientToolRegistry.getState().executeTool("ui_process_select_step", args);
  expect(select).not.toHaveBeenCalled();
  expect(newer).toHaveBeenCalledWith("docs");
  act(() =>
    root.render(
      <>
        <ProcessGuide agentContext={context} steps={steps} onStepSelect={newer} />
        <ProcessGuide agentContext={context} steps={steps} onStepSelect={newer} />
      </>,
    ),
  );
  expect(
    JSON.parse(await clientToolRegistry.getState().executeTool("ui_process_select_step", args))
      .status,
  ).toBe("error");
  render(false);
  expect(
    JSON.parse(await clientToolRegistry.getState().executeTool("ui_process_select_step", args))
      .status,
  ).toBe("error");
  expect(
    JSON.parse(await clientToolRegistry.getState().executeTool("ui_process_select_step", "null"))
      .status,
  ).toBe("error");
});
it("shows the selected step in the real With control and process status in its details", async () => {
  act(() =>
    root.render(
      <MemoryRouter>
        <ProcessGuide
          agentContext={context}
          steps={steps}
          currentStepId="review"
          selectedStepId="docs"
        />
        <ChatContext />
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Assessment › Documents"));
  await act(async () => host.querySelector<HTMLButtonElement>("[data-chat-context]")!.click());
  expect(document.body.textContent).toContain("Current: Review (Ready)");
  expect(document.body.textContent).toContain("Viewing: Documents (Completed)");
});

it("follows the focused process when several guides are present and cleans focus on deactivation", async () => {
  act(() =>
    root.render(
      <>
        <ProcessGuide agentContext={context} steps={steps} currentStepId="review" />
        <ProcessGuide
          agentContext={{ ...context, id: "other", label: "Other" }}
          steps={steps}
          currentStepId="docs"
        />
      </>,
    ),
  );
  const guides = host.querySelectorAll<HTMLElement>(".lykomi-process-guide");
  act(() => guides[1].dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(summarizeChatContext(useAppStore.getState().getAgentState()).detail).toBe(
    "Other › Documents",
  );
  const readContext = () =>
    clientToolRegistry.getState().executeTool("ui_process_get_context", "{}");
  expect(JSON.parse(await readContext())).toMatchObject({
    focusedProcess: { id: "other", sourcePage: "/assessment" },
    processes: [{ id: "assessment" }, { id: "other" }],
  });
  act(() => guides[0].dispatchEvent(new Event("focusin", { bubbles: true })));
  expect(summarizeChatContext(useAppStore.getState().getAgentState()).detail).toBe(
    "Assessment › Review",
  );
  render(false);
  expect(summarizeChatContext(useAppStore.getState().getAgentState()).detail).toBe("");
  expect(JSON.parse(await readContext())).toEqual({ focusedProcess: null, processes: [] });
});
