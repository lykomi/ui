import * as React from "react";

import { cn } from "@lykomi/web-primitives";

import { formatCompactNumber } from "./chart-config.ts";

/**
 * The KPI tile: one number that matters, with its trend. Dashboards lead
 * with a row of these — the primary figure top-left, everything else
 * subordinate — so the card keeps its own hierarchy strict: label small and
 * muted, value dominant, delta as a badge that carries the ONLY color.
 */
export interface StatCardProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** The number itself. Strings render verbatim (pre-formatted values). */
  value: number | string | null | undefined;
  /** "compact" → 1.03M; "plain" → 1,029,562. Ignored for string values. */
  format?: "compact" | "plain";
  /**
   * Percent change vs the comparison period, e.g. +12.4. Sign picks the
   * badge color; `invertDelta` flips which sign reads as good (error rates,
   * costs). Omit when there is no meaningful comparison — a fabricated
   * trend is worse than none.
   */
  delta?: number;
  /** What the delta compares against, e.g. "vs previous 30 days". */
  deltaLabel?: React.ReactNode;
  /** Lower-is-better metrics: a negative delta renders as good. */
  invertDelta?: boolean;
  /** Small print under the value (e.g. "63.1 MB across 11 files"). */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Compact trend slot, typically a Sparkline with a metric/period label. */
  trend?: React.ReactNode;
  /** Render a loading skeleton instead of the value. */
  loading?: boolean;
}

function formatValue(value: StatCardProps["value"], format: StatCardProps["format"]): string {
  if (value === null || value === undefined) return "–";
  if (typeof value === "string") return value;
  // Both branches take the same guard: a NaN must not render as "NaN" in
  // one format and "–" in the other.
  if (!Number.isFinite(value)) return "–";
  return format === "plain" ? value.toLocaleString() : formatCompactNumber(value);
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      label,
      value,
      format = "compact",
      delta,
      deltaLabel,
      invertDelta = false,
      hint,
      icon,
      trend,
      loading = false,
      className,
      ...props
    },
    ref,
  ) => {
    // A delta of Infinity is the natural result of dividing by a zero
    // previous period, and "▲ ∞%" styled as GOOD is worse than no badge.
    const hasDelta = delta !== undefined && Number.isFinite(delta);
    const direction = !hasDelta || delta === 0 ? "flat" : delta! > 0 ? "up" : "down";
    const good = delta !== undefined && delta !== 0 && (invertDelta ? delta < 0 : delta > 0);
    return (
      <div
        ref={ref}
        data-stat-card=""
        className={cn(
          "rounded-xl border border-border bg-card p-4 text-card-foreground",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          {icon && <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <span className="h-7 w-20 animate-pulse rounded-md bg-muted" data-stat-skeleton="" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums tracking-tight" data-stat-value="">
              {formatValue(value, format)}
            </span>
          )}
          {!loading && hasDelta && (
            <span
              data-stat-delta={direction === "flat" ? "flat" : good ? "good" : "bad"}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                direction === "flat"
                  ? "bg-muted text-muted-foreground"
                  : good
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {direction !== "flat" && <span aria-hidden>{direction === "up" ? "▲" : "▼"}</span>}
              <span className="sr-only">{direction === "flat" ? "unchanged" : direction} </span>
              {Math.abs(delta!).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
        {!loading && trend && (
          <div className="mt-3" data-stat-trend="">
            {trend}
          </div>
        )}
        {(hint || deltaLabel) && (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {hint}
            {hint && deltaLabel ? " · " : null}
            {deltaLabel}
          </div>
        )}
      </div>
    );
  },
);
StatCard.displayName = "StatCard";

export { StatCard };
