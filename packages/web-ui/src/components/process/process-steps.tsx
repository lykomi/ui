import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Check, CircleAlert, Clock3, Loader2, LockKeyhole, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip.tsx";
import { cn } from "@iloveagents/foundry-web-primitives";

export type ProcessStepStatus =
  | "pending"
  | "ready"
  | "running"
  | "complete"
  | "blocked"
  | "error"
  | "skipped";
export interface ProcessStep {
  /** Stable key, independent of the label or position. */
  id: string;
  label: string;
  status: ProcessStepStatus;
  /** Override the visible, accessible status label (also for localization). */
  statusLabel?: string;
  description?: ReactNode;
  /** Explain a prerequisite or failure. Never hide this behind a tooltip. */
  message?: ReactNode;
  /** Explicit opt-in; status alone never authorizes navigation. */
  selectable?: boolean;
}
export const processStatusLabels: Record<ProcessStepStatus, string> = {
  pending: "Not started",
  ready: "Ready",
  running: "In progress",
  complete: "Completed",
  blocked: "Blocked",
  error: "Needs attention",
  skipped: "Skipped",
};
const icons = {
  pending: Clock3,
  ready: null,
  running: Loader2,
  complete: Check,
  blocked: LockKeyhole,
  error: CircleAlert,
  skipped: Minus,
};
export interface ProcessStepsProps extends Omit<ComponentPropsWithoutRef<"div">, "onSelect"> {
  steps: readonly ProcessStep[];
  /** The actual current process step, independent of the step being inspected. */
  currentStepId?: string;
  selectedStepId?: string;
  onStepSelect?: (id: string) => void;
  variant?: "compact" | "overview";
  orientation?: "responsive" | "vertical";
  label?: string;
}

/** Controlled status visualization. No persistence, validation or automatic advancement. */
export function ProcessSteps({
  steps,
  currentStepId,
  selectedStepId,
  onStepSelect,
  variant = "compact",
  orientation = "responsive",
  label = "Process progress",
  className,
  ...props
}: ProcessStepsProps) {
  const inspectedId = steps.some((step) => step.id === selectedStepId)
    ? selectedStepId
    : currentStepId;
  if (!steps.length) return null;
  return (
    <div
      {...props}
      className={cn("foundry-process", className)}
      data-variant={variant}
      data-orientation={orientation}
    >
      <TooltipProvider delayDuration={200}>
        <ol className="foundry-process-steps" aria-label={label}>
          {steps.map((step, index) => {
            const Icon = icons[step.status];
            const current = step.id === currentStepId;
            const selected = step.id === inspectedId;
            const status = step.statusLabel ?? processStatusLabels[step.status];
            const content = (
              <>
                <span className="foundry-process-marker" aria-hidden="true">
                  {Icon ? (
                    <Icon
                      className={step.status === "running" ? "foundry-process-spinner" : undefined}
                    />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="foundry-process-copy">
                  <span className="foundry-process-label">{step.label}</span>
                  <span className="foundry-process-status">{status}</span>
                  {variant === "overview" && step.description ? (
                    <span className="foundry-process-description">{step.description}</span>
                  ) : null}
                  {step.message ? (
                    <span
                      className={
                        variant === "compact" && step.status === "blocked"
                          ? "foundry-process-sr"
                          : "foundry-process-message"
                      }
                    >
                      {step.message}
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li
                key={step.id}
                className="foundry-process-step"
                data-status={step.status}
                data-current={current || undefined}
                data-selected={selected || undefined}
                aria-current={current ? "step" : undefined}
              >
                {(!onStepSelect || !step.selectable) &&
                step.status === "blocked" &&
                step.message ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="foundry-process-target"
                        tabIndex={0}
                        aria-label={`${step.label}: ${status}`}
                      >
                        {content}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="foundry-process-tooltip">
                      {step.message}
                    </TooltipContent>
                  </Tooltip>
                ) : onStepSelect && step.selectable ? (
                  <button
                    type="button"
                    className="foundry-process-target"
                    onClick={() => onStepSelect(step.id)}
                    aria-pressed={selected}
                    aria-label={`${step.label}: ${status}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="foundry-process-target">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </TooltipProvider>
    </div>
  );
}
