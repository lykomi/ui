import { useEffect, useState } from "react";
import { Button } from "@lykomi/web-primitives";
import { useAppStore } from "@lykomi/web-ui";
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
} from "@lykomi/web-ui/chart";

const weeks = [
  { week: "Week 1", planting: 3, watering: 5, maintenance: 2 },
  { week: "Week 2", planting: 5, watering: 6, maintenance: 3 },
  { week: "Week 3", planting: 4, watering: 7, maintenance: 3 },
  { week: "Week 4", planting: 7, watering: 8, maintenance: 4 },
  { week: "Week 5", planting: 6, watering: 9, maintenance: 5 },
  { week: "Week 6", planting: 8, watering: 10, maintenance: 6 },
];
const series = {
  planting: { label: "Planting" },
  watering: { label: "Watering" },
  maintenance: { label: "Maintenance" },
};

/** The same filtered data drives every chart and the agent projection. */
export function DashboardExample() {
  const [period, setPeriod] = useState<3 | 6>(6);
  const rows = weeks.slice(-period);
  const totals = rows.map((row) => row.planting + row.watering + row.maintenance);
  const completed = totals.reduce((sum, value) => sum + value, 0);
  const goal = period * 20;
  const categories = Object.entries(series).map(([key, config]) => ({
    category: config.label,
    tasks: rows.reduce((sum, row) => sum + row[key as keyof typeof series], 0),
  }));
  const projection = JSON.stringify({
    exampleData: true,
    period: `Last ${period} example weeks`,
    unit: "completed tasks",
    completed,
    goal,
    weeklyAverage: Number((completed / period).toFixed(1)),
    rows,
    categories,
  });
  useEffect(() => {
    useAppStore.getState().setContextItem("showcase-dashboard", {
      type: "ref",
      label: "Garden dashboard",
      sourcePage: "/showcase/dashboard",
      persistence: "ephemeral",
      payload: {
        kind: "ref",
        refType: "dashboard",
        refId: "garden-dashboard",
        meta: JSON.parse(projection),
      },
    });
  }, [projection]);
  useEffect(() => () => useAppStore.getState().setContextItem("showcase-dashboard", null), []);
  return (
    <div className="@container space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Garden activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fictional weekly data. Change the period to update every chart and its context.
          </p>
        </div>
        <div role="group" aria-label="Dashboard period" className="flex gap-2">
          {([3, 6] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? "default" : "outline"}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {value} weeks
            </Button>
          ))}
        </div>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        Last {period} example weeks · {completed} completed tasks · goal {goal}
      </p>
      <DashboardGrid columns={1} className="@xl:grid-cols-2">
        <DashboardTile>
          <StatCard
            label="Completed tasks"
            value={completed}
            hint={`Across the last ${period} example weeks`}
            trend={
              <Sparkline data={totals} label={`Completed tasks over ${period} example weeks`} />
            }
          />
        </DashboardTile>
        <DashboardTile>
          <StatCard
            label="Weekly average"
            value={(completed / period).toFixed(1)}
            hint="Completed tasks per example week"
          />
        </DashboardTile>
      </DashboardGrid>
      <ChartCard
        title="Work over time"
        description="Completed tasks each week, grouped by activity."
      >
        <TimeSeriesChart data={rows} config={series} xKey="week" xTickFormatter={String} stacked />
      </ChartCard>
      <DashboardGrid columns={1} className="@xl:grid-cols-2">
        <DashboardTile>
          <ChartCard
            title="Activity breakdown"
            description="Total completed tasks in the selected period."
          >
            <CategoryBarChart
              data={categories}
              categoryKey="category"
              valueKey="tasks"
              config={{ tasks: { label: "Tasks" } }}
            />
          </ChartCard>
        </DashboardTile>
        <DashboardTile>
          <ChartCard title="Share of work" description="The same totals as shares of the whole.">
            <DonutChart
              data={categories}
              categoryKey="category"
              valueKey="tasks"
              centerLabel="Tasks"
            />
          </ChartCard>
        </DashboardTile>
      </DashboardGrid>
      <ChartCard
        title="Progress toward the plan"
        description="An example goal of 20 completed tasks per week."
      >
        <GaugeChart
          label="Completed tasks against goal"
          value={completed}
          max={goal}
          target={goal}
          showTargetMarker
          hint={`${completed} of ${goal} planned tasks`}
        />
      </ChartCard>
    </div>
  );
}
