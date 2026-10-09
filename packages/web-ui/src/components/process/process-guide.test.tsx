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
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Setup: Ready");
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
        showPosition
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

it("announces actual progress changes while an earlier step is inspected", () => {
  act(() =>
    root.render(<ProcessGuide steps={steps} currentStepId="setup" selectedStepId="docs" />),
  );
  act(() =>
    root.render(
      <ProcessGuide
        steps={steps.map((s) => (s.id === "setup" ? { ...s, status: "error" } : s))}
        currentStepId="setup"
        selectedStepId="docs"
      />,
    ),
  );
  expect(host.querySelector("h3")?.textContent).toBe("Documents");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Setup: Needs attention");
});

it("explains selectable blocked steps on keyboard focus without losing navigation", async () => {
  const select = vi.fn();
  act(() =>
    root.render(<ProcessSteps steps={[{ ...steps[2], selectable: true }]} onStepSelect={select} />),
  );
  const button = host.querySelector<HTMLButtonElement>("button")!;
  expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(
    "Confirm setup first.",
  );
  await act(async () => button.focus());
  expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Confirm setup first.");
  act(() => button.click());
  expect(select).toHaveBeenCalledWith("analysis");
});

it("associates overview descriptions and messages with selectable steps", () => {
  act(() =>
    root.render(
      <ProcessSteps
        variant="overview"
        steps={[
          {
            ...steps[1],
            description: "Verify the detected equipment",
            message: "Check nominal force",
          },
        ]}
        onStepSelect={() => {}}
      />,
    ),
  );
  const button = host.querySelector("button")!;
  const description = button
    .getAttribute("aria-describedby")!
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
  expect(description).toContain("Verify the detected equipment");
  expect(description).toContain("Check nominal force");
});

it("does not announce inspection as progress when the actual current step is absent", () => {
  for (const currentStepId of [undefined, "removed"]) {
    for (const selectedStepId of ["docs", "setup"]) {
      act(() =>
        root.render(
          <ProcessGuide
            steps={steps}
            currentStepId={currentStepId}
            selectedStepId={selectedStepId}
          />,
        ),
      );
      expect(host.querySelector("h3")?.textContent).toBe(
        selectedStepId === "docs" ? "Documents" : "Setup",
      );
      expect(host.querySelector('[role="status"]')?.textContent).toBe("");
    }
  }
});

it("keeps rich step guidance outside navigation buttons", () => {
  const select = vi.fn();
  const follow = vi.fn();
  act(() =>
    root.render(
      <ProcessSteps
        variant="overview"
        steps={[
          {
            ...steps[1],
            description: (
              <a href="#help" onClick={follow}>
                Help
              </a>
            ),
            message: <button>Resolve</button>,
          },
        ]}
        onStepSelect={select}
      />,
    ),
  );
  expect(host.querySelector("button a, button button")).toBeNull();
  act(() => host.querySelector<HTMLAnchorElement>("a")!.click());
  expect(follow).toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

it("reveals invalid folded fields with native errors and preserves form data", async () => {
  act(() =>
    root.render(
      <form>
        <ProcessGuide
          steps={[
            { ...steps[1], content: <input name="requiredValue" required defaultValue="" /> },
          ]}
          currentStepId="setup"
          guidance="collapsible"
        />
        <button type="submit">Save</button>
      </form>,
    ),
  );
  const form = host.querySelector("form")!;
  const input = host.querySelector<HTMLInputElement>("input")!;
  const report = vi.spyOn(input, "reportValidity").mockReturnValue(false);
  expect(input.closest("[hidden]")).not.toBeNull();
  let valid = true;
  act(() => {
    valid = form.checkValidity();
  });
  expect(valid).toBe(false);
  expect(input.closest("[hidden]")).toBeNull();
  expect(host.querySelector("input")).toBe(input);
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(report).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(input);
  input.value = "Saved value";
  expect(new FormData(form).get("requiredValue")).toBe("Saved value");
});

it("honors native region labels and lets the explicit guide label take precedence", () => {
  act(() => root.render(<ProcessGuide steps={steps} aria-label="Import workflow" />));
  expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Import workflow");
  act(() =>
    root.render(
      <ProcessGuide steps={steps} aria-label="Import workflow" label="Review workflow" />,
    ),
  );
  expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Review workflow");
});

it("routes native naming attributes to the progress list", () => {
  act(() => root.render(<ProcessSteps steps={steps} aria-label="Import progress" />));
  expect(host.querySelector("ol")?.getAttribute("aria-label")).toBe("Import progress");
  expect(host.querySelector(".foundry-process")?.hasAttribute("aria-label")).toBe(false);
  act(() => root.render(<ProcessSteps steps={steps} aria-labelledby="workflow-heading" />));
  expect(host.querySelector("ol")?.getAttribute("aria-labelledby")).toBe("workflow-heading");
  expect(host.querySelector(".foundry-process")?.hasAttribute("aria-labelledby")).toBe(false);
});

it("shares a heading-based guide name with the progress list", () => {
  act(() => root.render(<ProcessGuide steps={steps} aria-labelledby="workflow-heading" />));
  expect(host.querySelector("section")?.getAttribute("aria-labelledby")).toBe("workflow-heading");
  expect(host.querySelector("ol")?.getAttribute("aria-labelledby")).toBe("workflow-heading");
});

it("focuses only the first invalid control when revealing folded guidance", async () => {
  act(() =>
    root.render(
      <form>
        <ProcessGuide
          steps={[
            {
              ...steps[1],
              content: (
                <>
                  <input name="first" required />
                  <input name="second" required />
                </>
              ),
            },
          ]}
          currentStepId="setup"
          guidance="collapsible"
        />
      </form>,
    ),
  );
  const inputs = host.querySelectorAll<HTMLInputElement>("input");
  const firstReport = vi.spyOn(inputs[0], "reportValidity").mockReturnValue(false);
  const secondReport = vi.spyOn(inputs[1], "reportValidity").mockReturnValue(false);
  act(() => {
    host.querySelector("form")!.checkValidity();
  });
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(document.activeElement).toBe(inputs[0]);
  expect(firstReport).toHaveBeenCalledOnce();
  expect(secondReport).not.toHaveBeenCalled();
});

it("marks connections complete only when both adjacent steps are complete", () => {
  const progress = [
    { id: "docs", label: "Documents", status: "complete" as const },
    { id: "setup", label: "Setup", status: "complete" as const },
    { id: "analysis", label: "Analysis", status: "complete" as const },
    { id: "review", label: "Review", status: "ready" as const },
  ];
  act(() =>
    root.render(<ProcessSteps steps={progress} currentStepId="review" selectedStepId="docs" />),
  );
  const items = host.querySelectorAll("li");
  expect(items[0].hasAttribute("data-connection-complete")).toBe(true);
  expect(items[1].hasAttribute("data-connection-complete")).toBe(true);
  expect(items[2].hasAttribute("data-connection-complete")).toBe(false);
  act(() =>
    root.render(
      <ProcessSteps
        steps={progress.map((s) => ({ ...s, status: "complete" as const }))}
        selectedStepId="docs"
      />,
    ),
  );
  expect(host.querySelectorAll("li")[2].hasAttribute("data-connection-complete")).toBe(true);
});

it("compact standalone progress delegates clicks to the host and retains accessible status", () => {
  const action = vi.fn();
  act(() => root.render(<ProcessSteps steps={steps} density="compact" onStepSelect={action} />));
  const button = host.querySelector(
    'button[aria-label="Documents: Completed"]',
  ) as HTMLButtonElement;
  act(() => button.click());
  expect(action).toHaveBeenCalledWith("docs");
  expect(button.hasAttribute("aria-pressed")).toBe(false);
  expect(host.querySelector(".foundry-process-focus")).toBeNull();
  expect(host.querySelector('[aria-current="step"]')).toBeNull();
  act(() =>
    root.render(
      <ProcessSteps steps={steps} density="compact" currentStepId="setup" onStepSelect={action} />,
    ),
  );
  expect(host.querySelector("button[aria-pressed]")).toBeNull();
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Setup");
});
it("expanded guidance omits redundant counts and keeps the owning step label", () => {
  const guided = [
    { ...steps[0], title: "Choose source files", content: <input aria-label="Source" /> },
  ];
  act(() => root.render(<ProcessGuide steps={guided} currentStepId="docs" />));
  expect(host.querySelector(".foundry-process-position")?.textContent).toBe("Documents");
  expect(host.textContent).not.toContain("Step 1 of 1");
  expect(host.querySelector(".foundry-process-guidance-body")?.hasAttribute("hidden")).toBe(false);
  expect(host.querySelector(".foundry-process-disclosure")).toBeNull();
});

it("keeps chevrons opt-in and forwards the option from guidance to progress", () => {
  act(() => root.render(<ProcessGuide steps={steps} currentStepId="setup" />));
  expect(host.querySelector("[data-chevrons]")).toBeNull();
  act(() => root.render(<ProcessGuide steps={steps} currentStepId="setup" showChevrons />));
  expect(host.querySelector(".foundry-process")?.hasAttribute("data-chevrons")).toBe(true);
});
it("keeps optionality independent of navigation and localizes compact optional labels", () => {
  const onStepSelect = vi.fn();
  act(() =>
    root.render(
      <ProcessSteps
        density="compact"
        currentStepId="required"
        steps={[
          { id: "required", label: "Required", status: "ready", selectable: true },
          {
            id: "extra",
            label: "Extra",
            status: "ready",
            optional: true,
            optionalLabel: "Optionaler Schritt",
            selectable: true,
          },
          {
            id: "locked",
            label: "Locked",
            status: "blocked",
            optional: true,
            message: "Requires access.",
          },
        ]}
        onStepSelect={onStepSelect}
      />,
    ),
  );
  const extra = host.querySelector(
    'button[aria-label="Extra: Ready, Optionaler Schritt"]',
  ) as HTMLButtonElement;
  expect(extra).not.toBeNull();
  expect(extra.textContent).toContain("Optionaler Schritt");
  expect(host.querySelectorAll("button")).toHaveLength(2);
  act(() => extra.click());
  expect(onStepSelect).toHaveBeenCalledExactlyOnceWith("extra");
  expect(host.querySelector('[aria-current="step"]')?.textContent).toContain("Required");
});
it("only completes optional steps after the host records completion or a skip", () => {
  const extra: GuidedProcessStep = { id: "extra", label: "Extra", status: "ready", optional: true };
  act(() => root.render(<ProcessGuide steps={[extra]} completion="Finished!" />));
  expect(host.textContent).not.toContain("Finished!");
  act(() =>
    root.render(<ProcessGuide steps={[{ ...extra, status: "skipped" }]} completion="Finished!" />),
  );
  expect(host.textContent).toContain("Finished!");
});
