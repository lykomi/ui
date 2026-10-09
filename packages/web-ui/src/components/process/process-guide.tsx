import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  ProcessSteps,
  processStatusLabels,
  type ProcessStep,
  type ProcessStepsProps,
} from "./process-steps.tsx";

import { ProcessGuidance, type ProcessGuidanceOptions } from "./process-guidance.tsx";

export interface GuidedProcessStep extends ProcessStep {
  /** User-facing title, for example “Confirm the detected equipment”. */
  title?: string;
  content?: ReactNode;
  /** Host-owned actions: validate and persist in the host, not this component. */
  actions?: ReactNode;
}
export interface ProcessGuideProps
  extends
    ProcessGuidanceOptions,
    Omit<ComponentPropsWithoutRef<"section">, "onSelect" | "title" | "children"> {
  steps: readonly GuidedProcessStep[];
  currentStepId?: string;
  selectedStepId?: string;
  onStepSelect?: ProcessStepsProps["onStepSelect"];
  variant?: ProcessStepsProps["variant"];
  orientation?: ProcessStepsProps["orientation"];
  density?: ProcessStepsProps["density"];
  /** Show the numeric position in guidance; off when the rail already conveys it. */
  showPosition?: boolean;
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
  currentStepId,
  selectedStepId,
  onStepSelect,
  variant,
  orientation,
  density,
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
  className,
  ...props
}: ProcessGuideProps) {
  const accessibleLabel = label ?? ariaLabel ?? "Process progress";
  const selectedIndex = steps.findIndex((step) => step.id === selectedStepId);
  const index =
    selectedIndex >= 0 ? selectedIndex : steps.findIndex((step) => step.id === currentStepId);
  const finished = steps.every((step) => step.status === "complete" || step.status === "skipped");
  const step = steps[index];
  const liveStep = steps.find((candidate) => candidate.id === currentStepId);
  if (!steps.length) return null;
  return (
    <section
      {...props}
      className={cn("foundry-process-guide", className)}
      aria-label={accessibleLabel}
      aria-labelledby={ariaLabelledBy}
      data-framed={framed || undefined}
    >
      <ProcessSteps
        steps={steps}
        currentStepId={currentStepId}
        selectedStepId={step?.id}
        onStepSelect={onStepSelect}
        variant={variant}
        orientation={orientation}
        density={density}
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
          guidanceOpen={guidanceOpen}
          onGuidanceOpenChange={onGuidanceOpenChange}
          guidanceToggleLabel={guidanceToggleLabel}
        />
      ) : finished ? (
        (completion ?? null)
      ) : null}
    </section>
  );
}
