---
"@iloveagents/foundry-web-ui": minor
---

A chart family, sibling to the DataTable family — imported from the new
`@iloveagents/foundry-web-ui/chart` subpath (same reasoning as
`foundry-agent/msal`): charts are an optional tier, recharts is a real
dependency, and a host that never draws one keeps it out of its module
graph entirely. The family: `ChartContainer` /
`ChartTooltipContent` / `ChartLegendContent` (the shadcn-style layer over
recharts), declarative `TimeSeriesChart` / `CategoryBarChart` / `DonutChart`,
and the dashboard anatomy around them — `StatCard` (KPI tile with a
trend badge), `ChartCard`, `DashboardGrid`/`DashboardTile`.

Dashboards were the one surface hosts still hand-rolled: KPI tiles from bare
divs, bar charts from width-percentage flexboxes with `color-mix` — every
consumer re-inventing tooltip, legend, palette, and dark-mode behavior, and
none of it themeable. The theme runtime has carried five categorical slots
(`--chart-1..5`, light and dark, tenant-overridable) since its first release;
nothing in the library ever drew with them.

The layering mirrors the data-table split deliberately: `chart-config.ts`
owns semantics (a `ChartConfig` names each series once; colors resolve from
the declared order into the theme slots, so identity follows the series and a
filter never repaints the survivors), `chart.tsx` owns what is drawn.
Discipline the components enforce rather than document: a sixth category is
folded into "Other" (`foldCategoryTail`, `DonutChart.maxSlices`,
`CategoryBarChart.maxBars`), never a sixth color; the hover layer is on by
default; a single series gets no legend box; one y-axis, always.

recharts (^3) enters `dependencies` exactly the way `@tanstack/react-table`
did for tables. Nothing existing moves: every export is additive, and the
five chart slots keep their meaning for themes that predate this release.
