import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, compactAxisTick } from "./chart.tsx";
import {
  CHART_SLOT_COUNT,
  type ChartConfig,
  chartSlotColor,
  foldCategoryTail,
  seriesColor,
} from "./chart-config.ts";

/**
 * A ranked categorical breakdown ("tokens per department", "runs per
 * workflow"). Horizontal by default — category names read best on the y
 * axis. One measure = ONE hue (this is a magnitude comparison, not an
 * identity chart); `colorByCategory` switches to per-category slot colors
 * for the identity case, and `maxBars` folds the tail into "Other" instead
 * of inventing a sixth color.
 */
export interface CategoryBarChartProps {
  data: Array<Record<string, unknown>>;
  categoryKey: string;
  valueKey: string;
  /** Labels/colors. The `valueKey` entry names the measure in the tooltip. */
  config?: ChartConfig;
  /** Horizontal bars (default). Set false for vertical columns. */
  horizontal?: boolean;
  /** Fold rows beyond this count into an "Other" bar. */
  maxBars?: number;
  /** Give each category its own theme slot color (identity, not magnitude). */
  colorByCategory?: boolean;
  height?: number;
  /** Fixed pixel width opts out of responsive measurement (tests, embeds). */
  width?: number;
  valueFormatter?: (value: number) => React.ReactNode;
  /** Renders a category's axis/tooltip label. Defaults to the raw value. */
  categoryFormatter?: (value: unknown) => string;
  className?: string;
}

export function CategoryBarChart({
  data,
  categoryKey,
  valueKey,
  config = {},
  horizontal = true,
  maxBars,
  colorByCategory = false,
  height,
  width,
  valueFormatter,
  categoryFormatter,
  className,
}: CategoryBarChartProps) {
  // Identity coloring caps at the palette (5 + Other); a single-hue ranked
  // list caps at what stays readable. Both fold rather than overflow.
  const effectiveMax = maxBars ?? (colorByCategory ? CHART_SLOT_COUNT : 12);
  const rows = React.useMemo(() => {
    // This is a RANKED breakdown by contract, and the fold keeps the head —
    // rank first so an unsorted input never folds its biggest categories.
    const ranked = [...data].sort(
      (a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0),
    );
    return foldCategoryTail(ranked, { categoryKey, valueKey, max: effectiveMax });
  }, [data, categoryKey, valueKey, effectiveMax]);
  // Identity follows the category's position in the ORIGINAL data (or its
  // explicit config color) — filtering/sorting must not repaint survivors.
  const categoryColor = React.useCallback(
    (category: string): string => {
      const explicit = config[category]?.color;
      if (explicit) return explicit;
      // Declared identity first: a category's position in the CONFIG is
      // immune to the caller filtering the data. Data order is only the
      // fallback for undeclared categories.
      // The measure's own entry (labels/colors for the value column) is
      // not a category — it must not shift the identity order.
      const configIndex = Object.keys(config)
        .filter((key) => key !== valueKey)
        .indexOf(category);
      if (configIndex !== -1) return chartSlotColor(configIndex);
      const declared = data.findIndex((row) => String(row[categoryKey]) === category);
      return chartSlotColor(declared === -1 ? CHART_SLOT_COUNT - 1 : declared);
    },
    [config, data, categoryKey],
  );
  const fixed = width !== undefined;
  const resolvedHeight = height ?? (horizontal ? Math.max(160, rows.length * 36 + 24) : 240);
  const formatCategory = categoryFormatter ?? ((v: unknown) => String(v ?? ""));

  return (
    <ChartContainer
      config={config}
      responsive={!fixed}
      className={className}
      style={fixed ? undefined : { height: resolvedHeight, aspectRatio: "auto" }}
    >
      <RechartsPrimitive.BarChart
        data={rows}
        layout={horizontal ? "vertical" : "horizontal"}
        width={width}
        height={fixed ? resolvedHeight : undefined}
        margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
      >
        {horizontal ? (
          <>
            <RechartsPrimitive.XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={compactAxisTick}
            />
            <RechartsPrimitive.YAxis
              type="category"
              dataKey={categoryKey}
              width={140}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCategory}
            />
          </>
        ) : (
          <>
            <RechartsPrimitive.CartesianGrid vertical={false} strokeDasharray="3 3" />
            <RechartsPrimitive.XAxis
              dataKey={categoryKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatCategory}
            />
            <RechartsPrimitive.YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tickFormatter={compactAxisTick}
            />
          </>
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatCategory(label)}
              valueFormatter={valueFormatter}
              indicatorColor={
                colorByCategory ? (_key, label) => categoryColor(String(label)) : undefined
              }
            />
          }
        />
        <RechartsPrimitive.Bar
          dataKey={valueKey}
          fill={seriesColor(config, valueKey)}
          maxBarSize={28}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          isAnimationActive={false}
        >
          {colorByCategory &&
            rows.map((row, i) => {
              const category = String(row[categoryKey] ?? i);
              return <RechartsPrimitive.Cell key={category} fill={categoryColor(category)} />;
            })}
        </RechartsPrimitive.Bar>
      </RechartsPrimitive.BarChart>
    </ChartContainer>
  );
}
