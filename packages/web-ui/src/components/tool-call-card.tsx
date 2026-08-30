import { Loader2, CheckCircle2, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";
import { useState } from "react";
import type { ReactNode } from "react";

export type ToolCallStatus =
  | { type: "running" }
  | { type: "complete" }
  | { type: "incomplete"; reason?: string }
  | { type: "requires-action"; reason?: string };

export interface ToolCallCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  status: ToolCallStatus;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  children?: ReactNode;
  className?: string;
  /** Start expanded. Ignored when `open` is supplied. */
  defaultOpen?: boolean;
  /**
   * Controlled expansion.
   *
   * A card whose body is expensive to mount — a live force simulation, a media
   * player — needs to know whether it is expanded so it can defer that cost,
   * and needs to react when the user opens it. Left undefined, the card manages
   * its own state exactly as before.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ToolCallCard({
  icon,
  title,
  description,
  status,
  action,
  children,
  className,
  defaultOpen = false,
  open,
  onOpenChange,
}: ToolCallCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const isSuccess = status.type === "complete";
  const isError = status.type === "incomplete" && status.reason === "error";
  const isRunning = status.type === "running";
  const requiresAction = status.type === "requires-action";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border",
          "bg-muted/50 text-sm transition-colors",
          isSuccess && "border-primary/30 bg-primary/5",
          isError && "border-destructive/30 bg-destructive/5",
          requiresAction && "border-primary/30 bg-primary/5",
        )}
      >
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isRunning && <Loader2 className="size-4 text-primary animate-spin" />}
          {isSuccess && <CheckCircle2 className="size-4 text-primary" />}
          {isError && <XCircle className="size-4 text-destructive" />}
          {requiresAction && <AlertCircle className="size-4 text-primary" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span className="font-medium text-foreground">{title}</span>

            {/* Spacer pushes action + chevron to the right */}
            <div className="ml-auto flex items-center gap-1.5">
              {/* Quick action — always visible in header row */}
              {action && !isRunning && (
                <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    "h-6 px-2.5 text-xs font-medium rounded-md",
                    "border border-primary/30 text-primary",
                    "hover:bg-primary/10 transition-colors",
                    "disabled:opacity-50 disabled:pointer-events-none",
                  )}
                >
                  {action.label}
                </button>
              )}

              {/* Expand toggle — only if there are details to show */}
              {children && (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="p-0.5 hover:bg-muted rounded transition-colors"
                    aria-label="Toggle details"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>

          {description && (
            <div className={cn("text-xs mt-0.5", isError ? "text-destructive" : "text-primary")}>
              {description}
            </div>
          )}

          {children && (
            <CollapsibleContent>
              <div className="mt-2">{children}</div>
            </CollapsibleContent>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
