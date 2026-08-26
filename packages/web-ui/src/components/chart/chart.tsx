import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@iloveagents/foundry-web-primitives";

import {
  type ChartConfig,
  chartStyleVars,
  formatCompactNumber,
  seriesLabel,
  seriesVar,
} from "./chart-config.ts";

/**
 * The shadcn-style chart layer over recharts: `ChartContainer` injects one
 * `--chart-color-<key>` CSS variable per configured series (resolved from the
 * theme's `--chart-1..5` slots unless overridden), so every mark inside can
 * reference its series color with `seriesVar(key)` and follow theme
 * changes — light/dark and tenant themes alike — without re-rendering logic.
 *
 * Tooltip and legend CONTENT components read the same config through
 * context, so a series is named once and every surface agrees.
 */

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart(): ChartContextValue {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error("useChart must be used inside a <ChartContainer>");
  }
  return ctx;
}

export interface ChartContainerProps extends React.ComponentProps<"div"> {
  config: ChartConfig;
  /**
   * When false, children render without a ResponsiveContainer — for fixed
   * pixel sizes (the chart element then carries width/height itself), and
   * for test environments where layout measurement never settles.
   */
  responsive?: boolean;
  /** Exactly one chart element — ResponsiveContainer accepts a single child. */
  children: React.ReactElement;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, responsive = true, className, children, style, ...props }, ref) => {
    const vars = React.useMemo(() => chartStyleVars(config), [config]);
    const contextValue = React.useMemo(() => ({ config }), [config]);
    return (
      <ChartContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-chart=""
          className={cn(
            "flex w-full justify-center text-xs",
            // A fixed-size chart carries its own dimensions; forcing 16:9
            // on it would fight them.
            responsive && "aspect-video",
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
            "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60",
            "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
            "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50",
            "[&_.recharts-reference-line_line]:stroke-border",
            "[&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
            "[&_.recharts-layer]:outline-none",
            className,
          )}
          style={{ ...vars, ...style } as React.CSSProperties}
          {...props}
        >
          {responsive ? (
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement}
            </RechartsPrimitive.ResponsiveContainer>
          ) : (
            children
          )}
        </div>
      </ChartContext.Provider>
    );
  },
);
ChartContainer.displayName = "ChartContainer";

/** Recharts' Tooltip/Legend, re-exported so hosts never import recharts. */
const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartLegend = RechartsPrimitive.Legend;

type TooltipPayloadEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export interface ChartTooltipContentProps {
  active?: boolean;
  label?: unknown;
  payload?: TooltipPayloadEntry[];
  className?: string;
  /** Format the header (usually the x value). Defaults to `String(label)`. */
  labelFormatter?: (label: unknown) => React.ReactNode;
  /** Format each row's value. Defaults to `toLocaleString`. */
  valueFormatter?: (value: number) => React.ReactNode;
  /** Hide the color indicator squares. */
  hideIndicator?: boolean;
  /** Drop the header row entirely (a donut names its slice on the row). */
  hideLabel?: boolean;
  /**
   * Override the indicator color per row — for charts whose CELLS recolor
   * the marks (colorByCategory) while the payload still carries the parent
   * series color.
   */
  indicatorColor?: (entryKey: string, label: unknown) => string | undefined;
}

/**
 * The hover layer's content. Rows are named from the chart config (the
 * series key is a data column name — never show it raw when a label exists).
 */
function ChartTooltipContent({
  active,
  label,
  payload,
  className,
  labelFormatter,
  valueFormatter,
  hideIndicator = false,
  hideLabel = false,
  indicatorColor,
}: ChartTooltipContentProps) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "min-w-[9rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md",
        className,
      )}
    >
      {!hideLabel && (
        <div className="mb-1.5 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : String(label ?? "")}
        </div>
      )}
      <div className="grid gap-1">
        {payload.map((entry, i) => {
          // `name` first: a Pie names entries by its nameKey (the category),
          // while its dataKey is the measure column — the one label a donut
          // row must NOT wear. Series charts set name = dataKey, so nothing
          // changes for them.
          const key = String(entry.name ?? entry.dataKey ?? i);
          const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
          const finite = Number.isFinite(numeric);
          return (
            <div key={`${i}-${key}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {!hideIndicator && (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{
                      background: indicatorColor?.(key, label) ?? entry.color ?? seriesVar(key),
                    }}
                  />
                )}
                <span>{seriesLabel(config, key)}</span>
              </div>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {finite && valueFormatter
                  ? valueFormatter(numeric)
                  : finite
                    ? numeric.toLocaleString()
                    : String(entry.value ?? "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ChartLegendContentProps {
  payload?: Array<{ dataKey?: string | number; value?: unknown; color?: string }>;
  className?: string;
}

/** Legend rows named from the chart config, color chips from the payload. */
function ChartLegendContent({ payload, className }: ChartLegendContentProps) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3", className)}
    >
      {payload.map((entry, i) => {
        const key = String(entry.dataKey ?? entry.value ?? i);
        return (
          <div
            key={`${i}-${key}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: entry.color ?? seriesVar(key) }}
            />
            <span>{seriesLabel(config, key)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact y-axis tick formatter shared by the chart wrappers. */
export function compactAxisTick(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? formatCompactNumber(n) : String(value ?? "");
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent };
