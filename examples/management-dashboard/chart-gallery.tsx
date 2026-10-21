import * as React from "react";
import {
  CategoryBarChart,
  ChartCard,
  DashboardGrid,
  DonutChart,
  GaugeChart,
  Sparkline,
  StatCard,
  TimeSeriesChart,
} from "../../packages/web-ui/src/chart.ts";

const data = [
  { month: "Jan", direct: 42, partners: 24 },
  { month: "Feb", direct: 58, partners: 29 },
  { month: "Mar", direct: 51, partners: 38 },
  { month: "Apr", direct: 76, partners: 34 },
  { month: "May", direct: 82, partners: 47 },
  { month: "Jun", direct: 105, partners: 54 },
];
const categories = [
  { name: "Enterprise", value: 48 },
  { name: "Growth", value: 27 },
  { name: "Partners", value: 17 },
  { name: "Self-service", value: 8 },
];
const config = { direct: { label: "Direct" }, partners: { label: "Partners" } };
const percent = (n: number) => `${n}%`;

export function ChartGallery() {
  return (
    <div className="space-y-6">
      <section
        aria-label="Theme palette"
        className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 text-sm"
      >
        <span className="font-medium">Theme palette</span>
        {[1, 2, 3, 4, 5].map((slot) => (
          <span key={slot} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-4 rounded-full" style={{ background: `var(--chart-${slot})` }} />
            Series {slot}
          </span>
        ))}
      </section>
      <section aria-label="KPI cards" className="space-y-3">
        <h2 className="text-lg font-semibold">KPI cards & compact trends</h2>
        <DashboardGrid columns={4}>
          <StatCard
            label="Revenue"
            value="$3.04M"
            delta={18.6}
            deltaLabel="vs previous year"
            trend={<Sparkline data={[42, 58, 51, 76, 82, 105]} label="Revenue, January to June" />}
          />
          <StatCard
            label="Resolution time"
            value="2.4 days"
            delta={-16.2}
            invertDelta
            hint="Lower is better"
            trend={
              <Sparkline
                data={[5, 4, 4.5, 3.2, 3.4, 2.4]}
                label="Resolution time, January to June"
                className="text-chart-3"
              />
            }
          />
          <StatCard
            label="Cost per order"
            value="$28.40"
            delta={7.1}
            invertDelta
            hint="Above previous period"
          />
          <StatCard label="Awaiting refresh" value={null} loading hint="Loading state" />
        </DashboardGrid>
      </section>
      <section aria-label="Time series charts" className="space-y-3">
        <h2 className="text-lg font-semibold">Change over time</h2>
        <DashboardGrid columns={2}>
          <ChartCard
            title="Area chart"
            description="A clear sense of volume"
            footer="TimeSeriesChart · kind=area"
          >
            <TimeSeriesChart data={data} config={config} xKey="month" xTickFormatter={String} />
          </ChartCard>
          <ChartCard
            title="Line chart"
            description="Compare trends precisely"
            footer="TimeSeriesChart · kind=line"
          >
            <TimeSeriesChart
              data={data}
              config={config}
              xKey="month"
              xTickFormatter={String}
              kind="line"
            />
          </ChartCard>
          <ChartCard
            title="Stacked area"
            description="How each series contributes to the total"
            footer="TimeSeriesChart · kind=area · stacked"
          >
            <TimeSeriesChart
              data={data}
              config={config}
              xKey="month"
              xTickFormatter={String}
              stacked
            />
          </ChartCard>
          <ChartCard
            title="Grouped columns"
            description="Side-by-side period comparisons"
            footer="TimeSeriesChart · kind=bar"
          >
            <TimeSeriesChart
              data={data}
              config={config}
              xKey="month"
              xTickFormatter={String}
              kind="bar"
            />
          </ChartCard>
          <ChartCard
            title="Stacked columns"
            description="Period totals with their composition"
            footer="TimeSeriesChart · kind=bar · stacked"
          >
            <TimeSeriesChart
              data={data}
              config={config}
              xKey="month"
              xTickFormatter={String}
              kind="bar"
              stacked
            />
          </ChartCard>
          <ChartCard
            title="Sparklines"
            description="Small trends for cards and dense summaries"
            footer="Sparkline · gaps preserve missing samples"
          >
            <div className="space-y-5 pt-4">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Growth</p>
                <Sparkline data={[10, 18, 14, 28, 25, 39, 48]} label="Growth over seven months" />
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Missing observations</p>
                <Sparkline
                  data={[5, 8, null, 15, 12, 19]}
                  label="Observations over six months, third month missing"
                  className="text-chart-3"
                />
              </div>
            </div>
          </ChartCard>
        </DashboardGrid>
      </section>
      <section aria-label="Category charts" className="space-y-3">
        <h2 className="text-lg font-semibold">Rankings & composition</h2>
        <DashboardGrid columns={3}>
          <ChartCard
            title="Ranked bars"
            description="Compare category sizes"
            footer="CategoryBarChart · horizontal"
          >
            <CategoryBarChart data={categories} categoryKey="name" valueKey="value" />
          </ChartCard>
          <ChartCard
            title="Category columns"
            description="Category colors follow the theme"
            footer="CategoryBarChart · vertical · colorByCategory"
          >
            <CategoryBarChart
              data={categories}
              categoryKey="name"
              valueKey="value"
              horizontal={false}
              colorByCategory
            />
          </ChartCard>
          <ChartCard
            title="Donut chart"
            description="The share of a whole"
            footer="DonutChart · center total + visible shares"
          >
            <DonutChart
              data={categories}
              categoryKey="name"
              valueKey="value"
              height={200}
              centerLabel="Total share"
              centerValue="100%"
              valueFormatter={percent}
            />
          </ChartCard>
        </DashboardGrid>
      </section>
      <section aria-label="Gauge charts" className="space-y-3">
        <h2 className="text-lg font-semibold">Gauges & target attainment</h2>
        <DashboardGrid columns={3}>
          <ChartCard title="Neutral" description="A measurement without a status judgment">
            <GaugeChart
              label="Capacity used"
              value={68}
              target={80}
              showTargetMarker
              valueFormatter={percent}
              hint="Target marker at 80%"
            />
          </ChartCard>
          <ChartCard title="Success" description="Explicit positive metric status">
            <GaugeChart
              label="On-time delivery"
              value={92.4}
              target={90}
              tone="success"
              valueFormatter={percent}
              hint="Service target met"
            />
          </ChartCard>
          <ChartCard title="Warning" description="Highlight what needs attention">
            <GaugeChart
              label="Budget consumed"
              value={86}
              target={75}
              tone="warning"
              valueFormatter={percent}
              hint="Above the planned spend"
            />
          </ChartCard>
          <ChartCard title="Critical" description="Use text as well as color">
            <GaugeChart
              label="Error rate"
              value={12}
              max={20}
              target={5}
              tone="destructive"
              valueFormatter={percent}
              hint="Action required · lower is better"
            />
          </ChartCard>
          <ChartCard title="Custom range" description="Real units, including negative values">
            <GaugeChart
              label="Operating temperature"
              value={42}
              min={-20}
              max={80}
              target={60}
              valueFormatter={(value) => `${value}°C`}
            />
          </ChartCard>
          <ChartCard title="Missing & loading" description="No fabricated zero reading">
            <GaugeChart label="Awaiting measurement" value={null} />
            <GaugeChart label="Refreshing" value={72} loading className="mt-4" />
          </ChartCard>
        </DashboardGrid>
      </section>
      <p className="text-xs text-muted-foreground">
        Every chart uses the shared theme tokens. ChartCard, DashboardGrid and DashboardTile provide
        the frames and responsive layout. ChartContainer, ChartTooltip and ChartLegend support
        custom Recharts compositions.
      </p>
    </div>
  );
}
