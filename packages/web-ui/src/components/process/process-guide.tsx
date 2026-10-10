import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  ProcessSteps,
  processStatusLabels,
  type ProcessStep,
  type ProcessStepsProps,
} from "./process-steps.tsx";

import { useProcessAgentContext } from "./use-process-agent-context.ts";
import type { ProcessAgentContext } from "./process-agent-context.ts";

import { ProcessGuidance, type ProcessGuidanceOptions } from "./process-guidance.tsx";

export interface GuidedProcessStep extends ProcessStep {
  /** User-facing title, for example “Confirm the detected equipment”. */
  title?: string;
  /** Plain-text guidance for the agent when description/message contain JSX. */
  contextText?: { description?: string; message?: string };
  content?: ReactNode;
  /** Host-owned actions: validate and persist in the host, not this component. */
  actions?: ReactNode;
}
export interface ProcessGuideProps
  extends
    ProcessGuidanceOptions,
    Omit<ComponentPropsWithoutRef<"section">, "onSelect" | "title" | "children"> {
  steps: readonly GuidedProcessStep[];
  /** Share this active process with chat and AG-UI client tools. */
  agentContext?: ProcessAgentContext;
  currentStepId?: string;
  selectedStepId?: string;
  onStepSelect?: ProcessStepsProps["onStepSelect"];
  variant?: ProcessStepsProps["variant"];
  orientation?: ProcessStepsProps["orientation"];
  density?: ProcessStepsProps["density"];
  scrollLabels?: ProcessStepsProps["scrollLabels"];
  showChevrons?: ProcessStepsProps["showChevrons"];
  /** Show the numeric position in guidance; off when the rail already conveys it. */
  showPosition?: boolean;
  /** In compact guides, place the disclosure in the selected step; selecting opens guidance. */
  guidanceTogglePlacement?: "guidance" | "step";
  label?: string;
  /** Visually group the rail and guidance when embedded in a larger page. */
  framed?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** Allows localized “Step 2 of 4” without embedding English in the host. */
  formatPosition?: (index: number, total: number) => string;
  completion?: ReactNode;
}

/** Shared guide for sequential wizards and resumable background processes. */
export function ProcessGuide({
  steps,
  agentContext,
  currentStepId,
  selectedStepId,
  onStepSelect,
  variant,
  orientation,
  density,
  showChevrons,
  scrollLabels,
  showPosition = false,
  label,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  headingLevel = 3,
  formatPosition = (index, total) => `Step ${index} of ${total}`,
  completion,
  framed = false,
  guidance,
  defaultGuidanceOpen,
  guidanceOpen,
  onGuidanceOpenChange,
  guidanceToggleLabel,
  guidanceTogglePlacement = "guidance",
  className,
  onPointerDownCapture,
  onFocusCapture,
  ...props
}: ProcessGuideProps) {
  const guidanceId = useId();
  const [localGuidanceOpen, setLocalGuidanceOpen] = useState(defaultGuidanceOpen ?? false);
  const stepDisclosure =
    guidance === "collapsible" &&
    guidanceTogglePlacement === "step" &&
    (variant ?? "compact") === "compact";
  const open = guidanceOpen ?? localGuidanceOpen;
  function changeOpen(next: boolean) {
    if (guidanceOpen === undefined) setLocalGuidanceOpen(next);
    onGuidanceOpenChange?.(next);
  }
  const accessibleLabel = label ?? ariaLabel ?? "Process progress";
  const selectedIndex = steps.findIndex((step) => step.id === selectedStepId);
  const index =
    selectedIndex >= 0 ? selectedIndex : steps.findIndex((step) => step.id === currentStepId);
  const finished = steps.every((step) => step.status === "complete" || step.status === "skipped");
  const step = steps[index];
  const liveStep = steps.find((candidate) => candidate.id === currentStepId);
  const selectStep = onStepSelect
    ? (id: string) => {
        if (stepDisclosure) changeOpen(true);
        onStepSelect(id);
      }
    : undefined;
  const focusContext = useProcessAgentContext(
    agentContext,
    steps,
    currentStepId,
    step?.id,
    selectStep,
  );
  if (!steps.length) return null;
  return (
    <section
      {...props}
      onPointerDownCapture={(event) => {
        focusContext();
        onPointerDownCapture?.(event);
      }}
      onFocusCapture={(event) => {
        focusContext();
        onFocusCapture?.(event);
      }}
      className={cn("foundry-process-guide", className)}
      aria-label={accessibleLabel}
      aria-labelledby={ariaLabelledBy}
      data-framed={framed || undefined}
    >
      <ProcessSteps
        steps={steps}
        currentStepId={currentStepId}
        selectedStepId={step?.id}
        onStepSelect={selectStep}
        stepDisclosure={
          stepDisclosure && step
            ? {
                stepId: step.id,
                open,
                controls: guidanceId,
                label: guidanceToggleLabel ?? (open ? "Collapse guidance" : "Expand guidance"),
                onOpenChange: changeOpen,
              }
            : undefined
        }
        variant={variant}
        orientation={orientation}
        density={density}
        showChevrons={showChevrons}
        scrollLabels={scrollLabels}
        label={accessibleLabel}
        aria-labelledby={ariaLabelledBy}
      />
      {/* Announce state changes, not whole forms or high-frequency progress updates. */}
      <span className="foundry-process-sr" role="status" aria-atomic="true">
        {liveStep
          ? `${liveStep.label}: ${liveStep.statusLabel ?? processStatusLabels[liveStep.status]}`
          : ""}
      </span>
      {step ? (
        <ProcessGuidance
          key={step.id}
          step={step}
          headingLevel={headingLevel}
          position={showPosition ? formatPosition(index + 1, steps.length) : undefined}
          guidance={guidance}
          defaultGuidanceOpen={defaultGuidanceOpen}
          guidanceOpen={stepDisclosure ? open : guidanceOpen}
          onGuidanceOpenChange={stepDisclosure ? changeOpen : onGuidanceOpenChange}
          bodyId={stepDisclosure ? guidanceId : undefined}
          disclosureInStep={stepDisclosure}
          guidanceToggleLabel={guidanceToggleLabel}
        />
      ) : finished ? (
        (completion ?? null)
      ) : null}
    </section>
  );
}
