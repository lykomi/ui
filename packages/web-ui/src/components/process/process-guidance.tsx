import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GuidedProcessStep } from "./process-guide.tsx";

export interface ProcessGuidanceOptions {
  /** Collapsible guidance keeps the current task visible while hiding its detail. */
  guidance?: "expanded" | "collapsible";
  defaultGuidanceOpen?: boolean;
  guidanceOpen?: boolean;
  onGuidanceOpenChange?: (open: boolean) => void;
  guidanceToggleLabel?: string;
}

export function ProcessGuidance({
  step,
  position,
  headingLevel,
  guidance = "expanded",
  defaultGuidanceOpen = false,
  guidanceOpen,
  onGuidanceOpenChange,
  guidanceToggleLabel = "Guidance & actions",
}: ProcessGuidanceOptions & {
  step: GuidedProcessStep;
  position: string;
  headingLevel: 2 | 3 | 4;
}) {
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultGuidanceOpen);
  const collapsible = guidance === "collapsible";
  const open = !collapsible || (guidanceOpen ?? localOpen);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  function toggle() {
    if (guidanceOpen === undefined) setLocalOpen(!open);
    onGuidanceOpenChange?.(!open);
  }
  return (
    <div
      className="foundry-process-focus"
      aria-labelledby={`${id}-title`}
      data-status={step.status}
    >
      <div className="foundry-process-focus-header">
        <div className="foundry-process-focus-summary">
          <p className="foundry-process-position">
            {position} · {step.label}
          </p>
          <Heading id={`${id}-title`} className="foundry-process-title">
            {step.title ?? step.label}
          </Heading>
        </div>
        {collapsible ? (
          <button
            type="button"
            className="foundry-process-disclosure"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={toggle}
          >
            {guidanceToggleLabel}
            <ChevronDown aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {/* Keep forms mounted so folding guidance never discards unsaved input. */}
      <div id={`${id}-body`} className="foundry-process-guidance-body" hidden={!open}>
        {step.message ? (
          <div className="foundry-process-guidance-message" data-status={step.status}>
            {step.message}
          </div>
        ) : null}
        {step.description ? (
          <div className="foundry-process-guidance">{step.description}</div>
        ) : null}
        {step.content}
        {step.actions ? <div className="foundry-process-actions">{step.actions}</div> : null}
      </div>
    </div>
  );
}
