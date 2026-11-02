/**
 * The chart subpath — `@iloveagents/foundry-web-ui/chart`.
 *
 * Charts are an optional tier: recharts is a real dependency, and a host
 * that never draws one should not carry it into its module graph. The
 * root barrel therefore does not re-export this file (same reasoning as
 * `@iloveagents/foundry-agent/msal`); import from the subpath.
 */

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
  compactAxisTick,
  type ChartContainerProps,
  type ChartTooltipContentProps,
  type ChartLegendContentProps,
} from "./components/chart/chart.tsx";
export {
  FOLD_COLOR,
  OTHER_LABEL,
  categoryColorResolver,
  chartSlotColor,
  chartStyleVars,
  foldCategoryTail,
  formatBucketLabel,
  formatCompactNumber,
  seriesColor,
  seriesLabel,
  seriesVar,
  seriesVarName,
  CHART_SLOT_COUNT,
  type ChartConfig,
  type ChartSeriesConfig,
} from "./components/chart/chart-config.ts";
export { StatCard, type StatCardProps } from "./components/chart/stat-card.tsx";
export {
  ChartCard,
  DashboardGrid,
  DashboardTile,
  type ChartCardProps,
  type DashboardGridProps,
  type DashboardTileProps,
} from "./components/chart/chart-card.tsx";
export {
  TimeSeriesChart,
  type TimeSeriesChartProps,
} from "./components/chart/time-series-chart.tsx";
export {
  CategoryBarChart,
  type CategoryBarChartProps,
} from "./components/chart/category-bar-chart.tsx";
export { DonutChart, type DonutChartProps } from "./components/chart/donut-chart.tsx";
export {
  GaugeChart,
  type GaugeChartProps,
  type GaugeSegment,
} from "./components/chart/gauge-chart.tsx";
export { Sparkline, type SparklineProps } from "./components/chart/sparkline.tsx";
