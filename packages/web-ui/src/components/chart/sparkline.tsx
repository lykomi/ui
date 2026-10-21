import * as React from "react";

import { cn } from "@iloveagents/foundry-web-primitives";

export interface SparklineProps extends Omit<React.ComponentProps<"svg">, "children"> {
  /** Equally spaced samples. Missing/non-finite samples leave a gap. */
  data: readonly (number | null)[];
  /** Describe both the metric and the period; the line has no axes. */
  label: string;
}

/** A compact, theme-colored trend. Use a full chart for exact comparisons. */
export function Sparkline({ data, label, className, ...props }: SparklineProps) {
  const finite = data.filter((v): v is number => v !== null && Number.isFinite(v));
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  // Scale before subtracting to avoid overflow for large finite samples.
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const range = max / scale - min / scale;
  let connected = false;
  const points: Array<{ x: number; y: number }> = [];
  const path = data
    .map((value, index) => {
      if (value === null || !Number.isFinite(value)) {
        connected = false;
        return "";
      }
      const x = data.length > 1 ? 3 + (index / (data.length - 1)) * 154 : 80;
      const y = range > 0 ? 37 - ((value / scale - min / scale) / range) * 34 : 20;
      points.push({ x, y });
      const command = `${connected ? "L" : "M"} ${x} ${y}`;
      connected = true;
      return command;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 160 40"
      preserveAspectRatio="none"
      role="img"
      aria-label={finite.length ? label : `${label}: No data`}
      className={cn("h-10 w-full text-chart-1", className)}
      {...props}
    >
      <g
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} vectorEffect="non-scaling-stroke" />
        {points.map(({ x, y }, index) => (
          <circle key={index} cx={x} cy={y} r="1.5" fill="currentColor" stroke="none" />
        ))}
      </g>
    </svg>
  );
}
