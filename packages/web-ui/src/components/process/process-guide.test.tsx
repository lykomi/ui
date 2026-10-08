import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ProcessGuide, type GuidedProcessStep } from "./process-guide.tsx";
import { ProcessSteps } from "./process-steps.tsx";
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const steps: GuidedProcessStep[] = [
  { id: "docs", label: "Documents", status: "complete", selectable: true },
  { id: "setup", label: "Setup", status: "ready", selectable: true },
  { id: "analysis", label: "Analysis", status: "blocked", message: "Confirm setup first." },
];
it("exposes current process state independently of the inspected step", () => {
  act(() =>
    root.render(<ProcessGuide steps={steps} currentStepId="setup" selectedStepId="docs" />),
  );
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Setup");
  expect(host.querySelector("h3")?.textContent).toBe("Documents");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Documents: Completed");
});
it("only explicitly selectable steps navigate, and clicks do not advance the process", () => {
  const onStepSelect = vi.fn();
  act(() =>
    root.render(<ProcessGuide steps={steps} currentStepId="setup" onStepSelect={onStepSelect} />),
  );
  const buttons = host.querySelectorAll("button");
  expect(buttons.length).toBe(2);
  act(() => buttons[0].click());
  expect(onStepSelect).toHaveBeenCalledWith("docs");
  expect(host.querySelector("h3")?.textContent).toBe("Setup");
  expect(host.querySelector("[data-selected]")?.getAttribute("data-current")).not.toBeNull();
  expect(host.textContent).toContain("Confirm setup first.");
});
it("keeps passive process indicators out of keyboard navigation", () => {
  act(() => root.render(<ProcessSteps steps={steps} currentStepId="setup" />));
  expect(host.querySelectorAll("button").length).toBe(0);
  expect(host.querySelectorAll("li").length).toBe(3);
});
it("shows errors and blockers as text and announces status updates", () => {
  const updated = steps.map((s) =>
    s.id === "setup"
      ? { ...s, status: "error" as const, message: "Saved progress. Retry setup." }
      : s,
  );
  act(() => root.render(<ProcessGuide steps={updated} currentStepId="setup" />));
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Setup: Needs attention");
  expect(host.textContent).toContain("Saved progress. Retry setup.");
  expect(host.querySelector("[data-current]")?.getAttribute("data-status")).toBe("error");
});
it("falls back from a removed selection and never claims an unfinished process is complete", () => {
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps}
        currentStepId="setup"
        selectedStepId="removed"
        completion="Finished!"
      />,
    ),
  );
  expect(host.querySelector("h3")?.textContent).toBe("Setup");
  expect(host.querySelector("[data-selected]")?.getAttribute("data-current")).not.toBeNull();
  act(() =>
    root.render(<ProcessGuide steps={steps} currentStepId="removed" completion="Finished!" />),
  );
  expect(host.textContent).not.toContain("Finished!");
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps.map((s) => ({ ...s, status: "complete" }))}
        completion="Finished!"
      />,
    ),
  );
  expect(host.textContent).toContain("Finished!");
});
it("supports translated statuses and position labels", () => {
  act(() =>
    root.render(
      <ProcessGuide
        steps={[{ ...steps[1], statusLabel: "Bereit" }]}
        currentStepId="setup"
        headingLevel={2}
        formatPosition={(n, total) => `Schritt ${n} von ${total}`}
      />,
    ),
  );
  expect(host.querySelector("h2")?.textContent).toBe("Setup");
  expect(host.textContent).toContain("Schritt 1 von 1");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Setup: Bereit");
});
it("folds guidance and actions without unmounting input or hiding blockers", () => {
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps.map((s) =>
          s.id === "setup"
            ? {
                ...s,
                content: <input aria-label="Draft value" defaultValue="Unsaved draft" />,
                actions: <button>Continue</button>,
              }
            : s,
        )}
        currentStepId="setup"
        guidance="collapsible"
      />,
    ),
  );
  const disclosure = host.querySelector<HTMLButtonElement>("button[aria-controls]")!;
  const body = document.getElementById(disclosure.getAttribute("aria-controls")!)!;
  const input = body.querySelector<HTMLInputElement>("input")!;
  expect(disclosure.getAttribute("aria-expanded")).toBe("false");
  expect(body.hidden).toBe(true);
  expect(host.textContent).toContain("Confirm setup first.");
  act(() => disclosure.click());
  expect(body.hidden).toBe(false);
  input.value = "Edited draft";
  act(() => disclosure.click());
  act(() => disclosure.click());
  expect(body.querySelector("input")).toBe(input);
  expect(input.value).toBe("Edited draft");
});
it("allows host-controlled disclosure without changing state on its own", () => {
  const change = vi.fn();
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps}
        currentStepId="setup"
        guidance="collapsible"
        guidanceOpen={false}
        onGuidanceOpenChange={change}
      />,
    ),
  );
  const disclosure = host.querySelector<HTMLButtonElement>("button[aria-controls]")!;
  act(() => disclosure.click());
  expect(change).toHaveBeenCalledWith(true);
  expect(disclosure.getAttribute("aria-expanded")).toBe("false");
});
it("resets uncontrolled disclosure to the initial state when changing inspected steps", () => {
  act(() =>
    root.render(<ProcessGuide steps={steps} currentStepId="setup" guidance="collapsible" />),
  );
  act(() => host.querySelector<HTMLButtonElement>("button[aria-controls]")!.click());
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps}
        currentStepId="setup"
        selectedStepId="docs"
        guidance="collapsible"
      />,
    ),
  );
  expect(host.querySelector("button[aria-controls]")?.getAttribute("aria-expanded")).toBe("false");
});
