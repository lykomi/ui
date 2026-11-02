import * as React from "react";

import { cn } from "@iloveagents/foundry-web-primitives";

import { GaugeSegments, validGaugeSegments, type GaugeSegment } from "./gauge-segments.tsx";
export type { GaugeSegment } from "./gauge-segments.tsx";

export interface GaugeChartProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  /** A marker in the same units as value. Out-of-range targets are omitted. */
  target?: number;
  /** An ordered breakdown whose values sum to max - min. Uses the same units as value. */
  segments?: readonly GaugeSegment[];
  targetLabel?: string;
  /** Opt in to a tick on the arc. The target text remains visible without it. */
  showTargetMarker?: boolean;
  /** Explicit metric semantics: a higher value is not always better. */
  tone?: "neutral" | "success" | "warning" | "destructive";
  valueFormatter?: (value: number) => string;
  hint?: React.ReactNode;
  loading?: boolean;
  emptyLabel?: string;
}

const COLORS = {
  neutral: "var(--chart-1)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};
const formatNumber = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** A bounded semicircle with a readable actual value and an optional target. */
export const GaugeChart = React.forwardRef<HTMLDivElement, GaugeChartProps>(
  (
    {
      label,
      value,
      min = 0,
      max = 100,
      target,
      segments,
      targetLabel = "Target",
      showTargetMarker = false,
      tone = "neutral",
      valueFormatter = formatNumber,
      hint,
      loading = false,
      emptyLabel = "No data",
      className,
      ...props
    },
    ref,
  ) => {
    const validRange =
      Number.isFinite(min) && Number.isFinite(max) && max > min && Number.isFinite(max - min);
    const validSegments =
      segments === undefined || (validRange && validGaugeSegments(segments, max - min));
    const available =
      !loading &&
      validRange &&
      validSegments &&
      typeof value === "number" &&
      Number.isFinite(value);
    const bounded = available ? Math.min(max, Math.max(min, value)) : min;
    const fraction = available ? (bounded - min) / (max - min) : 0;
    const hasTarget =
      validRange &&
      target !== undefined &&
      Number.isFinite(target) &&
      target >= min &&
      target <= max;
    const angle = hasTarget ? Math.PI * (1 - (target - min) / (max - min)) : 0;
    const display = loading
      ? "Loading…"
      : !validSegments
        ? "Invalid breakdown"
        : available
          ? valueFormatter(value)
          : emptyLabel;
    const breakdownText =
      available && segments
        ? segments.map((segment) => `${segment.label}: ${valueFormatter(segment.value)}`).join("; ")
        : undefined;
    const targetText = hasTarget ? `${targetLabel}: ${valueFormatter(target)}` : undefined;

    return (
      <div
        ref={ref}
        className={cn("flex min-w-0 flex-col items-center text-card-foreground", className)}
        data-gauge-chart=""
        aria-busy={loading || undefined}
        {...props}
      >
        <div className="text-sm font-medium">{label}</div>
        <svg
          viewBox="0 0 240 154"
          className="w-full max-w-xs overflow-visible"
          role={available ? "meter" : "img"}
          aria-label={available ? label : `${label}: ${display}`}
          aria-valuemin={available ? min : undefined}
          aria-valuemax={available ? max : undefined}
          aria-valuenow={available ? bounded : undefined}
          aria-valuetext={
            available ? [display, targetText, breakdownText].filter(Boolean).join("; ") : undefined
          }
        >
          <g aria-hidden="true">
            <path
              d="M 24 120 A 96 96 0 0 1 216 120"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </g>
          {available && segments ? (
            <GaugeSegments segments={segments} range={max - min} valueFormatter={valueFormatter} />
          ) : null}
          <g aria-hidden="true">
            {available && !segments && fraction > 0 && (
              <path
                data-gauge-fill=""
                d="M 24 120 A 96 96 0 0 1 216 120"
                fill="none"
                stroke={COLORS[tone]}
                strokeWidth="14"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${fraction * 100} 100`}
              />
            )}
            {hasTarget && showTargetMarker && (
              <line
                data-gauge-target=""
                x1={120 + 84 * Math.cos(angle)}
                y1={120 - 84 * Math.sin(angle)}
                x2={120 + 108 * Math.cos(angle)}
                y2={120 - 108 * Math.sin(angle)}
                stroke="var(--foreground)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
            <text
              x="120"
              y="102"
              textAnchor="middle"
              fill="currentColor"
              className="text-2xl font-semibold tabular-nums tracking-tight"
            >
              {display}
            </text>
            {validRange && (
              <g fill="var(--muted-foreground)" className="text-[10px] tabular-nums">
                <text x="24" y="145" textAnchor="middle">
                  {valueFormatter(min)}
                </text>
                <text x="216" y="145" textAnchor="middle">
                  {valueFormatter(max)}
                </text>
              </g>
            )}
          </g>
        </svg>
        {targetText && <div className="text-xs text-muted-foreground">{targetText}</div>}
        {hint && <div className="mt-1 text-center text-xs text-muted-foreground">{hint}</div>}
      </div>
    );
  },
);
GaugeChart.displayName = "GaugeChart";
