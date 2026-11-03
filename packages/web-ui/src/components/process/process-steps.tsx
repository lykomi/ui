import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
  CircleCheck,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  LockKeyhole,
  CircleMinus,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip.tsx";
import { useProcessScroll } from "./use-process-scroll.ts";
import { Button, cn } from "@iloveagents/foundry-web-primitives";

export type ProcessStepStatus =
  /** Awaiting availability or scheduling; not yet ready to execute. */
  "pending" | "ready" | "running" | "complete" | "blocked" | "error" | "skipped";
export interface ProcessStep {
  /** Stable key, independent of the label or position. */
  id: string;
  label: string;
  status: ProcessStepStatus;
  /** Override the visible, accessible status label (also for localization). */
  statusLabel?: string;
  /** Optionality is independent of prerequisites and execution status. */
  optional?: boolean;
  /** Localized optionality label; defaults to Optional. */
  optionalLabel?: string;
  description?: ReactNode;
  /** Explain a prerequisite or failure. Never hide this behind a tooltip. */
  message?: ReactNode;
  /** Explicit opt-in; status alone never authorizes navigation. */
  selectable?: boolean;
}
export const processStatusLabels: Record<ProcessStepStatus, string> = {
  pending: "Waiting",
  ready: "Ready",
  running: "In progress",
  complete: "Completed",
  blocked: "Blocked",
  error: "Needs attention",
  skipped: "Skipped",
};
const statusIcons = {
  pending: Clock3,
  running: Loader2,
  complete: CircleCheck,
  blocked: LockKeyhole,
  error: CircleAlert,
  skipped: CircleMinus,
};

/** Status remains visible when a completed or skipped step is inspected again. */
function ProcessStatusIcon({
  status,
  selected,
  optional,
}: {
  status: ProcessStepStatus;
  selected: boolean;
  optional?: boolean;
}) {
  // Optionality changes the *unstarted* marker only. Running, completed,
  // blocked and failed steps keep their actual status symbols.
  if (optional && (status === "pending" || status === "ready")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
        {status === "ready" && selected ? (
          <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
        ) : null}
      </svg>
    );
  }
  if (status === "ready") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        {selected ? <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" /> : null}
      </svg>
    );
  }
  const Icon = statusIcons[status];
  return <Icon className={status === "running" ? "foundry-process-spinner" : undefined} />;
}

export interface ProcessStepsProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onSelect" | "children"
> {
  steps: readonly ProcessStep[];
  /** The actual current process step, independent of the step being inspected. */
  currentStepId?: string;
  /** Step being inspected; selection never changes execution status. */
  selectedStepId?: string;
  onStepSelect?: (id: string) => void;
  variant?: "compact" | "overview";
  orientation?: "responsive" | "vertical" | "horizontal";
  /** Compact density keeps only marker and label visible; status stays accessible. */
  density?: "comfortable" | "compact";
  /** Decorative separators for horizontal compact navigation; off by default. */
  showChevrons?: boolean;
  /** Localized labels for overflow navigation buttons. */
  scrollLabels?: { previous: string; next: string };
  label?: string;
  /** Optional independent disclosure for the inspected step's guidance. */
  stepDisclosure?: {
    stepId: string;
    open: boolean;
    controls: string;
    label: string;
    onOpenChange: (open: boolean) => void;
  };
}

/** Controlled status visualization. No persistence, validation or automatic advancement. */
export function ProcessSteps({
  steps,
  currentStepId,
  selectedStepId,
  onStepSelect,
  variant = "compact",
  orientation = "responsive",
  density = "comfortable",
  showChevrons = false,
  stepDisclosure,
  scrollLabels = { previous: "Show previous steps", next: "Show next steps" },
  label,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  ...props
}: ProcessStepsProps) {
  const messagePrefix = useId();
  const inspectedId = steps.some((step) => step.id === selectedStepId)
    ? selectedStepId
    : currentStepId;
  const scroll = useProcessScroll(
    inspectedId,
    `${variant}/${orientation}/${density}/${steps.map((step) => step.id).join("/")}`,
  );
  if (!steps.length) return null;
  return (
    <div
      {...props}
      className={cn("foundry-process", className)}
      data-variant={variant}
      data-orientation={orientation}
      data-density={density}
      data-chevrons={showChevrons || undefined}
    >
      <div ref={scroll.frame} className="foundry-process-scroller">
        {scroll.edges.overflow ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="foundry-process-scroll-button"
            aria-label={scrollLabels.previous}
            disabled={!scroll.edges.previous}
            onClick={() => scroll.move(-1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
        ) : null}
        <div
          ref={scroll.viewport}
          className="foundry-process-viewport"
          tabIndex={scroll.edges.overflow ? 0 : undefined}
          role={scroll.edges.overflow ? "region" : undefined}
          aria-labelledby={scroll.edges.overflow ? ariaLabelledBy : undefined}
          aria-label={
            scroll.edges.overflow && !ariaLabelledBy
              ? (label ?? ariaLabel ?? "Process progress")
              : undefined
          }
          data-previous={scroll.edges.previous || undefined}
          data-next={scroll.edges.next || undefined}
          onFocusCapture={(event) => {
            if (event.target instanceof HTMLElement && event.target !== event.currentTarget)
              scroll.reveal(event.target);
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              scroll.move(event.key === "ArrowLeft" ? -1 : 1, true);
            }
            if (event.key === "Home" || event.key === "End") {
              const target =
                event.key === "Home"
                  ? scroll.track.current?.firstElementChild
                  : scroll.track.current?.lastElementChild;
              if (target instanceof HTMLElement) {
                event.preventDefault();
                scroll.reveal(target);
              }
            }
          }}
        >
          <TooltipProvider delayDuration={200}>
            <ol
              ref={scroll.track}
              className="foundry-process-steps"
              aria-label={label ?? ariaLabel ?? "Process progress"}
              aria-labelledby={ariaLabelledBy}
            >
              {steps.map((step, index) => {
                const current = step.id === currentStepId;
                const selected = step.id === inspectedId;
                const status = step.statusLabel ?? processStatusLabels[step.status];
                const optionalLabel = step.optional
                  ? (step.optionalLabel ?? "Optional")
                  : undefined;
                const accessibleStatus = `${step.label}: ${status}${optionalLabel ? `, ${optionalLabel}` : ""}`;
                const messageId = step.message ? `${messagePrefix}-message-${index}` : undefined;
                const descriptionId =
                  variant === "overview" && step.description
                    ? `${messagePrefix}-description-${index}`
                    : undefined;
                const describedBy =
                  [descriptionId, messageId].filter(Boolean).join(" ") || undefined;
                const content = (
                  <>
                    <span className="foundry-process-marker" aria-hidden="true">
                      <ProcessStatusIcon
                        status={step.status}
                        selected={selected}
                        optional={step.optional}
                      />
                    </span>
                    <span className="foundry-process-copy">
                      <span className="foundry-process-name">
                        <span className="foundry-process-label">{step.label}</span>
                        {optionalLabel ? (
                          <span className="foundry-process-optional">{optionalLabel}</span>
                        ) : null}
                      </span>
                      <span className="foundry-process-status">{status}</span>
                    </span>
                  </>
                );
                const target =
                  onStepSelect && step.selectable ? (
                    <button
                      type="button"
                      className="foundry-process-target"
                      onClick={() => onStepSelect(step.id)}
                      aria-pressed={selectedStepId !== undefined ? selected : undefined}
                      aria-label={accessibleStatus}
                      aria-describedby={describedBy}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      className="foundry-process-target"
                      tabIndex={step.status === "blocked" && step.message ? 0 : undefined}
                      aria-label={step.status === "blocked" ? accessibleStatus : undefined}
                      aria-describedby={describedBy}
                    >
                      {content}
                    </div>
                  );
                return (
                  <li
                    key={step.id}
                    className="foundry-process-step"
                    data-status={step.status}
                    data-disclosure={stepDisclosure?.stepId === step.id || undefined}
                    data-connection-complete={
                      ((step.status === "complete" || step.status === "skipped") &&
                        (steps[index + 1]?.status === "complete" ||
                          steps[index + 1]?.status === "skipped")) ||
                      undefined
                    }
                    data-current={current || undefined}
                    data-selected={selected || undefined}
                    aria-current={current ? "step" : undefined}
                  >
                    <div className="foundry-process-step-surface">
                      {step.status === "blocked" &&
                      typeof step.message === "string" &&
                      step.message ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{target}</TooltipTrigger>
                          <TooltipContent className="foundry-process-tooltip">
                            {step.message}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        target
                      )}
                      {stepDisclosure?.stepId === step.id ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="foundry-process-step-disclosure"
                              aria-label={`${stepDisclosure.label}: ${step.label}`}
                              aria-expanded={stepDisclosure.open}
                              aria-controls={stepDisclosure.controls}
                              onClick={() => stepDisclosure.onOpenChange(!stepDisclosure.open)}
                            >
                              <ChevronDown aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="foundry-process-tooltip">
                            {stepDisclosure.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    <div className="foundry-process-detail">
                      {variant === "overview" && step.description ? (
                        <div id={descriptionId} className="foundry-process-description">
                          {step.description}
                        </div>
                      ) : null}
                      {step.message ? (
                        <div
                          id={messageId}
                          className={
                            variant === "compact" &&
                            step.status === "blocked" &&
                            typeof step.message === "string"
                              ? "foundry-process-sr foundry-process-compact-blocker"
                              : "foundry-process-message"
                          }
                        >
                          {step.message}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </TooltipProvider>
        </div>
        {scroll.edges.overflow ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="foundry-process-scroll-button"
            aria-label={scrollLabels.next}
            disabled={!scroll.edges.next}
            onClick={() => scroll.move(1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
