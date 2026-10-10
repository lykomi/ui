import { useId, useRef, useState, type FormEvent } from "react";
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
  bodyId,
  disclosureInStep = false,
}: ProcessGuidanceOptions & {
  step: GuidedProcessStep;
  position?: string;
  headingLevel: 2 | 3 | 4;
  bodyId?: string;
  disclosureInStep?: boolean;
}) {
  const id = useId();
  const revealPending = useRef(false);
  const [localOpen, setLocalOpen] = useState(defaultGuidanceOpen);
  const collapsible = guidance === "collapsible";
  const open = !collapsible || (guidanceOpen ?? localOpen);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  function changeOpen(next: boolean) {
    if (guidanceOpen === undefined) setLocalOpen(next);
    onGuidanceOpenChange?.(next);
  }
  function revealInvalid(event: FormEvent<HTMLDivElement>) {
    if (revealPending.current) {
      event.preventDefault();
      return;
    }
    if (open) return;
    // Preserve form values and validation; reveal the field instead of silently excluding it.
    event.preventDefault();
    revealPending.current = true;
    changeOpen(true);
    const control = event.target as HTMLElement & { reportValidity?: () => boolean };
    requestAnimationFrame(() => {
      revealPending.current = false;
      if (control.isConnected && !control.closest("[hidden]")) {
        control.focus();
        control.reportValidity?.();
      }
    });
  }
  return (
    <div
      className="foundry-process-focus"
      aria-labelledby={`${id}-title`}
      data-status={step.status}
      hidden={disclosureInStep && !open}
    >
      <div className="foundry-process-focus-header">
        <div className="foundry-process-focus-summary">
          {position || (step.title && step.title !== step.label) ? (
            <p className="foundry-process-position">
              {position ? `${position} · ${step.label}` : step.label}
            </p>
          ) : null}
          <Heading id={`${id}-title`} className="foundry-process-title">
            {step.title ?? step.label}
          </Heading>
        </div>
        {collapsible && !disclosureInStep ? (
          <button
            type="button"
            className="foundry-process-disclosure"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => changeOpen(!open)}
          >
            {guidanceToggleLabel}
            <ChevronDown aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {/* Keep forms mounted so folding guidance never discards unsaved input. */}
      <div
        id={bodyId ?? `${id}-body`}
        className="foundry-process-guidance-body"
        hidden={!open}
        onInvalidCapture={revealInvalid}
      >
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
