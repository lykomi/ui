import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  LockKeyhole,
  Minus,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip.tsx";
import { useProcessScroll } from "./use-process-scroll.ts";
import { Button, cn } from "@iloveagents/foundry-web-primitives";

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
export interface ProcessStepsProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onSelect" | "children"
> {
  steps: readonly ProcessStep[];
  /** The actual current process step, independent of the step being inspected. */
  currentStepId?: string;
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
                const Icon = icons[step.status];
                const current = step.id === currentStepId;
                const selected = step.id === inspectedId;
                const status = step.statusLabel ?? processStatusLabels[step.status];
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
                      {Icon ? (
                        <Icon
                          className={
                            step.status === "running" ? "foundry-process-spinner" : undefined
                          }
                        />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="foundry-process-copy">
                      <span className="foundry-process-label">{step.label}</span>
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
                      aria-label={`${step.label}: ${status}`}
                      aria-describedby={describedBy}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      className="foundry-process-target"
                      tabIndex={step.status === "blocked" && step.message ? 0 : undefined}
                      aria-label={
                        step.status === "blocked" ? `${step.label}: ${status}` : undefined
                      }
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
                    data-connection-complete={
                      (step.status === "complete" && steps[index + 1]?.status === "complete") ||
                      undefined
                    }
                    data-current={current || undefined}
                    data-selected={selected || undefined}
                    aria-current={current ? "step" : undefined}
                  >
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
