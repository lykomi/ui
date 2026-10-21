import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  CategoryBarChart,
  ChartCard,
  DashboardGrid,
  DashboardTile,
  DonutChart,
  GaugeChart,
  Sparkline,
  StatCard,
  TimeSeriesChart,
} from "../../packages/web-ui/src/chart.ts";
import "./generated.css";
import { ChartGallery } from "./chart-gallery.tsx";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const revenue = [181, 195, 190, 214, 232, 248, 254, 267, 283, 296, 321, 359];
const plan = [190, 200, 210, 220, 230, 240, 255, 270, 285, 300, 315, 330];
const rows = months.map((month, i) => ({ month, revenue: revenue[i], plan: plan[i] }));
const channels = [
  { channel: "Enterprise", value: 48 },
  { channel: "Growth", value: 27 },
  { channel: "Partners", value: 17 },
  { channel: "Self-service", value: 8 },
];
const regions = [
  { region: "Europe", value: 1160 },
  { region: "North America", value: 880 },
  { region: "Asia Pacific", value: 710 },
  { region: "Other regions", value: 290 },
];
const percent = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const money = (value: number) => `$${value.toLocaleString()}k`;

function Demo() {
  const [dark, setDark] = React.useState(false);
  const [period, setPeriod] = React.useState("year");
  const [gallery, setGallery] = React.useState(
    new URLSearchParams(window.location.search).has("gallery"),
  );
  const half = period === "half";
  const selected = half ? rows.slice(6) : rows;
  const trend = selected.map((row) => row.revenue);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span aria-hidden="true" className="size-2 rounded-full bg-chart-1" />
              {gallery ? "Component gallery" : "Executive briefing"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {gallery ? "Charts, in every shade." : "Performance, in perspective."}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {gallery
                ? "Explore every chart component in light and dark."
                : "The numbers that matter. The context to act."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={gallery}
              onClick={() => setGallery(!gallery)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {gallery ? "Show dashboard" : "All components"}
            </button>
            {!gallery && (
              <>
                <label className="sr-only" htmlFor="period">
                  Reporting period
                </label>
                <select
                  id="period"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="year">Full year</option>
                  <option value="half">Second half</option>
                </select>
              </>
            )}
            <button
              type="button"
              aria-pressed={dark}
              onClick={() => setDark(!dark)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              Dark mode
            </button>
          </div>
        </header>

        {gallery ? (
          <ChartGallery />
        ) : (
          <>
            <section
              aria-label="Performance summary"
              className="rounded-xl border border-chart-1/20 bg-chart-1/5 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className="rounded-md bg-success/10 px-2 py-1 text-xs text-success">
                  On track
                </span>
                A strong finish, with room to grow.
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                December revenue is 8.8% above plan. Delivery meets its 90% target; enterprise
                accounts contribute 48% of revenue.
              </p>
            </section>

            <section aria-label="Key performance indicators">
              <DashboardGrid columns={4}>
                <StatCard
                  label="Revenue"
                  value={half ? "$1.78M" : "$3.04M"}
                  delta={half ? 40.9 : 18.6}
                  deltaLabel="vs previous period"
                  hint={half ? "July – December" : "January – December"}
                  trend={
                    <Sparkline data={trend} label="Monthly revenue during the selected period" />
                  }
                />
                <StatCard
                  label="Operating margin"
                  value={half ? "25.1%" : "24.8%"}
                  hint="Target: 24% · above target"
                  trend={
                    <Sparkline
                      data={
                        half
                          ? [24, 24.4, 24.6, 24.8, 25, 25.1]
                          : [21, 22, 21.8, 23, 23.4, 23.9, 24, 24.4, 24.6, 24.8, 25, 25.1]
                      }
                      label="Monthly operating margin during the selected period"
                    />
                  }
                />
                <StatCard
                  label="Active customers"
                  value={half ? 1284 : 1340}
                  delta={12.3}
                  deltaLabel="vs previous period"
                  hint="Across all regions"
                  trend={
                    <Sparkline
                      data={
                        half
                          ? [990, 1025, 1100, 1135, 1220, 1284]
                          : [860, 940, 910, 1020, 1090, 1130, 1180, 1205, 1240, 1280, 1310, 1340]
                      }
                      label="Monthly active customers during the selected period"
                    />
                  }
                />
                <StatCard
                  label="Resolution time"
                  value={half ? "2.1 days" : "2.4 days"}
                  delta={-16.2}
                  invertDelta
                  deltaLabel="vs previous period"
                  hint="Lower is better"
                  trend={
                    <Sparkline
                      data={
                        half
                          ? [2.8, 2.5, 2.6, 2.3, 2.2, 2.1]
                          : [3.8, 3.6, 3.7, 3.2, 3.3, 3, 2.9, 2.7, 2.8, 2.5, 2.3, 2.4]
                      }
                      label="Monthly resolution time during the selected period"
                      className="text-chart-3"
                    />
                  }
                />
              </DashboardGrid>
            </section>

            <section aria-label="Revenue and delivery">
              <DashboardGrid columns={3}>
                <DashboardTile span={2}>
                  <ChartCard
                    title="Revenue momentum"
                    description={
                      half
                        ? "July – December · USD thousands"
                        : "January – December · USD thousands"
                    }
                    footer="Actual revenue against the monthly operating plan."
                  >
                    <TimeSeriesChart
                      data={selected}
                      xKey="month"
                      kind="line"
                      height={260}
                      config={{
                        revenue: { label: "Revenue" },
                        plan: { label: "Plan", color: "var(--chart-3)" },
                      }}
                      valueFormatter={money}
                      xTickFormatter={String}
                    />
                  </ChartCard>
                </DashboardTile>
                <ChartCard
                  title="Delivery reliability"
                  description="Orders delivered on time"
                  footer="Target met · higher is better"
                >
                  <GaugeChart
                    label="On-time delivery"
                    value={half ? 94.1 : 92.4}
                    target={90}
                    tone="success"
                    valueFormatter={percent}
                    hint="Above the service commitment"
                    className="pt-4"
                  />
                </ChartCard>
              </DashboardGrid>
            </section>

            <section aria-label="Revenue breakdowns">
              <DashboardGrid columns={3}>
                <DashboardTile span={2}>
                  <ChartCard
                    title="Revenue by region"
                    description="Full year · USD thousands"
                    footer="Europe leads the portfolio; Asia Pacific remains the growth opportunity."
                  >
                    <CategoryBarChart
                      data={regions}
                      categoryKey="region"
                      valueKey="value"
                      height={230}
                      config={{ value: { label: "Revenue" } }}
                      valueFormatter={money}
                    />
                  </ChartCard>
                </DashboardTile>
                <ChartCard
                  title="Customer mix"
                  description="Full year · share of revenue"
                  footer="Diversified routes to market."
                >
                  <DonutChart
                    data={channels}
                    categoryKey="channel"
                    valueKey="value"
                    height={180}
                    centerValue="48%"
                    centerLabel="Enterprise"
                    valueFormatter={percent}
                  />
                </ChartCard>
              </DashboardGrid>
            </section>
          </>
        )}
        <footer className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>Foundry UI · Management dashboard components</span>
          <span>Illustrative data · static demonstration</span>
        </footer>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
