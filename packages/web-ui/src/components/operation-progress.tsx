import type { ReactNode } from "react";
import type { AssistantContext } from "../lib/assistant-context.ts";
import { AlertCircle, CheckCircle2, Clock3, Loader2, TriangleAlert, Ban } from "lucide-react";
import { cn } from "@lykomi/web-primitives";
import { AskAIButton } from "./ask-ai-button.tsx";

export interface OperationProgressProps {
  /** Short description of the operation, not its implementation. */
  title: string;
  status: "running" | "pending" | "success" | "warning" | "error" | "cancelled";
  description?: ReactNode;
  /** A measured percentage (0–100). null means the total is unknown.
   * Omit to show no bar. Never derive a percentage from elapsed time. */
  progress?: number | null;
  /** e.g. "18 of 24 files" or "Discovering files…". */
  progressLabel?: string;
  /** Only supply an estimate when the caller has reliable measurements. */
  estimate?: string;
  /** Explain background work only after a durable job has been confirmed. */
  backgroundNote?: string;
  /** Opt in to chat help for error/warning states. Supply a bounded question and authorized context. */
  assistantPrompt?: string;
  /** Bounded UI facts, separate from the user-facing question. */
  assistantContext?: AssistantContext;
  /** Localized action label; defaults to "Ask AI". */
  assistantLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  /** Disable the frame when the host already supplies a surface. */
  framed?: boolean;
  density?: "comfortable" | "compact";
  className?: string;
}

const appearance = {
  running: { Icon: Loader2, tone: "text-primary", bar: "bg-primary" },
  pending: { Icon: Clock3, tone: "text-muted-foreground", bar: "bg-muted-foreground" },
  success: { Icon: CheckCircle2, tone: "text-success", bar: "bg-success" },
  warning: { Icon: TriangleAlert, tone: "text-warning", bar: "bg-warning" },
  error: { Icon: AlertCircle, tone: "text-destructive", bar: "bg-destructive" },
  cancelled: { Icon: Ban, tone: "text-muted-foreground", bar: "bg-muted-foreground" },
};

/** Shared presentation for native jobs and authored renderers. It owns no
 * fetching, timers, retries or completion logic. Callers keep authoritative
 * job state; refreshing that state never remounts the surrounding content. */
export function OperationProgress({
  title,
  status,
  description,
  progress,
  progressLabel,
  estimate,
  backgroundNote,
  assistantPrompt,
  assistantContext,
  assistantLabel,
  actions,
  children,
  framed = true,
  density = "comfortable",
  className,
}: OperationProgressProps) {
  const { Icon, tone, bar } = appearance[status];
  const measured =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, progress))
      : undefined;
  const showHelp = (status === "error" || status === "warning") && !!assistantPrompt?.trim();
  const showBar = progress !== undefined;
  const indeterminate = measured === undefined && status === "running";
  return (
    <section
      aria-label={title}
      data-operation-status={status}
      className={cn(
        "min-w-0 text-sm",
        framed && "rounded-lg border border-border bg-muted/20",
        framed && (density === "compact" ? "p-3" : "p-4"),
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center", tone)}>
          <Icon
            aria-hidden="true"
            className={cn(
              "size-4",
              status === "running" && "animate-spin motion-reduce:animate-none",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div
              className="min-w-0 flex-1 basis-48"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="m-0 font-medium leading-5 text-foreground">{title}</p>
              {description && (
                <div className="mt-1 text-sm leading-5 text-muted-foreground">{description}</div>
              )}
            </div>
            {(actions || showHelp) && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
                {showHelp && (
                  <AskAIButton
                    prompt={assistantPrompt!}
                    context={assistantContext}
                    label={assistantLabel}
                  />
                )}
              </div>
            )}
          </div>
          {(progressLabel || estimate) && (
            <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-5 tabular-nums text-muted-foreground">
              <span>{progressLabel}</span>
              <span>{estimate}</span>
            </div>
          )}
          {showBar && (
            <div
              role="progressbar"
              aria-label={title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={measured}
              aria-valuetext={progressLabel}
              className="relative mt-2 h-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300",
                  bar,
                  indeterminate && "operation-progress-indeterminate",
                )}
                style={{ width: indeterminate ? "30%" : `${measured ?? 0}%` }}
              />
            </div>
          )}
          {backgroundNote && (
            <p className="mb-0 mt-3 text-xs leading-5 text-muted-foreground">{backgroundNote}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </section>
  );
}
