import * as React from "react";
import * as RechartsPrimitive from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  compactAxisTick,
} from "./chart.tsx";
import { type ChartConfig, formatBucketLabel, seriesVar } from "./chart-config.ts";

/**
 * Change over time — the dashboard's workhorse. Declarative enough that a
 * renderer (or the builder agent) states WHAT to plot and nothing else:
 *
 *   <TimeSeriesChart
 *     data={rows} xKey="bucket"
 *     config={{ chat: { label: "Chat" }, workflow: { label: "Workflows" } }}
 *     kind="area" stacked
 *   />
 *
 * Series colors come from the theme's categorical slots in config order;
 * the hover layer (crosshair + tooltip) is on by default; one y-axis, ever.
 */
export interface TimeSeriesChartProps {
  data: Array<Record<string, unknown>>;
  /** Series semantics — keys must match data columns. Order = color order. */
  config: ChartConfig;
  /** The x column. Defaults to `"bucket"` (the usage APIs' column). */
  xKey?: string;
  /** Which config keys to draw. Defaults to every key in `config`. */
  series?: string[];
  kind?: "area" | "line" | "bar";
  /**
   * Stack the series (area/bar). A LINE chart has no stacked form —
   * recharts' Line does not stack — so for `kind="line"` this prop is
   * ignored; use `kind="area"` when the total matters.
   */
  stacked?: boolean;
  /** Pixel height of the plot (the container spans full width). */
  height?: number;
  /** Fixed pixel width opts out of responsive measurement (tests, embeds). */
  width?: number;
  valueFormatter?: (value: number) => React.ReactNode;
  /** X tick + tooltip header formatter. Defaults to bucket-aware dates. */
  xTickFormatter?: (value: unknown) => string;
  /** Defaults to true when more than one series is drawn. */
  showLegend?: boolean;
  className?: string;
}

export function TimeSeriesChart({
  data,
  config,
  xKey = "bucket",
  series,
  kind = "area",
  stacked = false,
  height = 240,
  width,
  valueFormatter,
  xTickFormatter = formatBucketLabel,
  showLegend,
  className,
}: TimeSeriesChartProps) {
  const keys = series ?? Object.keys(config);
  const legend = showLegend ?? keys.length > 1;
  const fixed = width !== undefined;
  const ChartRoot =
    kind === "line"
      ? RechartsPrimitive.LineChart
      : kind === "bar"
        ? RechartsPrimitive.BarChart
        : RechartsPrimitive.AreaChart;

  return (
    <ChartContainer
      config={config}
      responsive={!fixed}
      className={className}
      style={fixed ? undefined : { height, aspectRatio: "auto" }}
    >
      <ChartRoot
        data={data}
        width={width}
        height={fixed ? height : undefined}
        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
      >
        <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="3 3" />
        <RechartsPrimitive.XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={xTickFormatter}
        />
        <RechartsPrimitive.YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tickFormatter={compactAxisTick}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={xTickFormatter} valueFormatter={valueFormatter} />
          }
        />
        {legend && <ChartLegend content={<ChartLegendContent />} />}
        {keys.map((key) =>
          kind === "line" ? (
            <RechartsPrimitive.Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={seriesVar(key)}
              strokeWidth={2}
              dot={data.length <= 3 ? { r: 3 } : false}
              isAnimationActive={false}
            />
          ) : kind === "bar" ? (
            <RechartsPrimitive.Bar
              key={key}
              dataKey={key}
              stackId={stacked ? "stack" : undefined}
              fill={seriesVar(key)}
              maxBarSize={48}
              radius={stacked ? 0 : [4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ) : (
            <RechartsPrimitive.Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId={stacked ? "stack" : undefined}
              stroke={seriesVar(key)}
              fill={seriesVar(key)}
              fillOpacity={0.25}
              strokeWidth={2}
              // A one-or-two point window would otherwise draw a floating
              // speck; dots make sparse data read as sparse, not broken.
              dot={data.length <= 3 ? { r: 3 } : false}
              isAnimationActive={false}
            />
          ),
        )}
      </ChartRoot>
    </ChartContainer>
  );
}
