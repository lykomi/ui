import { useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip.tsx";

export interface GaugeSegment {
  label: string;
  value: number;
  color: string;
  description?: string;
}

export function validGaugeSegments(segments: readonly GaugeSegment[], range: number): boolean {
  return (
    segments.length > 0 &&
    segments.every(
      (segment) =>
        segment.label.trim().length > 0 &&
        segment.color.trim().length > 0 &&
        Number.isFinite(segment.value) &&
        segment.value >= 0,
    ) &&
    Math.abs(segments.reduce((total, segment) => total + segment.value, 0) - range) <=
      Math.max(1, range) * 1e-6
  );
}

const point = (fraction: number) => {
  const angle = Math.PI * (1 - fraction);
  return [120 + 96 * Math.cos(angle), 120 - 96 * Math.sin(angle)];
};

/** Exact adjacent arc lengths; rounded outer caps never enlarge an interior segment. */
export function GaugeSegments({
  segments,
  range,
  valueFormatter,
}: {
  segments: readonly GaugeSegment[];
  range: number;
  valueFormatter: (value: number) => string;
}) {
  const [focused, setFocused] = useState<number | null>(null);
  let offset = 0;
  return (
    <TooltipProvider delayDuration={150}>
      {segments.map((segment, index) => {
        const start = offset;
        offset += segment.value / range;
        if (!segment.value) return null;
        const from = point(start);
        const to = point(offset);
        const text = `${segment.label}: ${valueFormatter(segment.value)}`;
        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <g
                data-gauge-segment={index}
                tabIndex={0}
                role="img"
                aria-label={text}
                className="outline-none"
                onFocus={(event) =>
                  setFocused(event.currentTarget.matches(":focus-visible") ? index : null)
                }
                onBlur={() => setFocused(null)}
              >
                <path
                  d={`M ${from[0]} ${from[1]} A 96 96 0 0 1 ${to[0]} ${to[1]}`}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={focused === index ? 18 : 14}
                  strokeLinecap="butt"
                />
                {start === 0 ? (
                  <circle cx={from[0]} cy={from[1]} r="7" fill={segment.color} />
                ) : null}
                {Math.abs(offset - 1) < 1e-6 ? (
                  <circle cx={to[0]} cy={to[1]} r="7" fill={segment.color} />
                ) : null}
              </g>
            </TooltipTrigger>
            <TooltipContent>
              <div className="font-medium">{text}</div>
              {segment.description ? (
                <div className="mt-1 max-w-60">{segment.description}</div>
              ) : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </TooltipProvider>
  );
}
