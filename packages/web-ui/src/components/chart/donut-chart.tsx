import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@iloveagents/foundry-web-primitives";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart.tsx";
import {
  CHART_SLOT_COUNT,
  type ChartConfig,
  categoryColorResolver,
  foldCategoryTail,
  formatCompactNumber,
} from "./chart-config.ts";

/**
 * Share of a whole ("tokens per model"). Slices are identities, so each
 * takes a theme slot resolved over the DRAWN slices — declared config keys
 * first, the rest in drawn order — and there are only five slots,
 * so `maxSlices` folds the tail into a muted "Other" (ranked first, so the
 * fold can never swallow the largest slice) instead of inventing colors.
 * The center carries the headline total; the legend carries names + shares,
 * so the hover layer is confirmation, not the only way to read the chart.
 */
export interface DonutChartProps {
  data: Array<Record<string, unknown>>;
  categoryKey: string;
  valueKey: string;
  /** Per-category label/color overrides, keyed by category value. */
  config?: ChartConfig;
  /** Fold categories beyond this count into "Other". Default 5. */
  maxSlices?: number;
  centerLabel?: React.ReactNode;
  /** Defaults to the compact-formatted sum of all slices. */
  centerValue?: React.ReactNode;
  height?: number;
  /** Fixed pixel width opts out of responsive measurement (tests, embeds). */
  width?: number;
  valueFormatter?: (value: number) => React.ReactNode;
  showLegend?: boolean;
  className?: string;
}

const EMPTY_CONFIG: ChartConfig = {};

export function DonutChart({
  data,
  categoryKey,
  valueKey,
  config = EMPTY_CONFIG,
  maxSlices = 5,
  centerLabel,
  centerValue,
  height = 240,
  width,
  valueFormatter,
  showLegend = true,
  className,
}: DonutChartProps) {
  // The donut's slices are identities and the palette has five slots —
  // a cap above that would wrap colors modulo five.
  const cappedSlices = Math.min(CHART_SLOT_COUNT, maxSlices);
  // One expression for "this row's category", so the color resolver and
  // the rendered cell can never disagree about a missing value.
  const categoryOf = React.useCallback(
    (row: Record<string, unknown>, i: number) => String(row[categoryKey] ?? i),
    [categoryKey],
  );
  const rows = React.useMemo(
    () => foldCategoryTail(data, { categoryKey, valueKey, max: cappedSlices }),
    [data, categoryKey, valueKey, cappedSlices],
  );
  const total = React.useMemo(
    () =>
      rows.reduce((sum, row) => {
        const value = Number(row[valueKey]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [rows, valueKey],
  );
  // Identity resolved over the DRAWN slices: the fold ranks, so a category
  // late in the input can be promoted, and resolving from input order would
  // paint that visible slice the muted past-the-palette grey.
  const sliceColor = React.useMemo(
    () =>
      categoryColorResolver(
        config,
        rows.map((row) => String(row[categoryKey] ?? "")),
      ),
    [config, rows, categoryOf],
  );
  const fixed = width !== undefined;
  const sliceLabel = (category: string): React.ReactNode => config[category]?.label ?? category;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative">
        <ChartContainer
          config={config}
          responsive={!fixed}
          style={fixed ? undefined : { height, aspectRatio: "auto" }}
        >
          <RechartsPrimitive.PieChart width={width} height={fixed ? height : undefined}>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel valueFormatter={valueFormatter} />}
            />
            <RechartsPrimitive.Pie
              data={rows}
              dataKey={valueKey}
              nameKey={categoryKey}
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {rows.map((row, i) => {
                const category = String(row[categoryKey] ?? i);
                return (
                  <RechartsPrimitive.Cell key={`${i}-${category}`} fill={sliceColor(category)} />
                );
              })}
            </RechartsPrimitive.Pie>
          </RechartsPrimitive.PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums" data-donut-center="">
            {centerValue ?? formatCompactNumber(total)}
          </span>
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
          {rows.map((row, i) => {
            const category = String(row[categoryKey] ?? i);
            const raw = Number(row[valueKey]);
            const value = Number.isFinite(raw) ? raw : 0;
            const pct = total > 0 ? (value / total) * 100 : 0;
            // A real slice must never read as absent: below 1% says so.
            const share = pct > 0 && pct < 1 ? "<1" : String(Math.round(pct));
            return (
              <div
                key={`${i}-${category}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: sliceColor(category) }}
                />
                <span>{sliceLabel(category)}</span>
                <span className="tabular-nums">{share}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
