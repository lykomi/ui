import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ChartContainer, ChartTooltipContent } from "../components/chart/chart.tsx";
import {
  chartStyleVars,
  foldCategoryTail,
  formatBucketLabel,
  seriesColor,
} from "../components/chart/chart-config.ts";
import { StatCard } from "../components/chart/stat-card.tsx";
import { TimeSeriesChart } from "../components/chart/time-series-chart.tsx";
import { CategoryBarChart } from "../components/chart/category-bar-chart.tsx";
import { DonutChart } from "../components/chart/donut-chart.tsx";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(node: React.ReactElement): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(node);
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe("chart semantics", () => {
  it("assigns theme slots in declared order and lets config override", () => {
    const config = { a: {}, b: {}, c: { color: "var(--destructive)" } };
    expect(chartStyleVars(config)).toEqual({
      "--color-a": "var(--chart-1)",
      "--color-b": "var(--chart-2)",
      "--color-c": "var(--destructive)",
    });
  });

  it("color follows the series, not its rank — b keeps slot 2 when drawn alone", () => {
    // The config declares the identity order; which series a chart currently
    // draws must not repaint the survivors.
    const config = { a: {}, b: {} };
    expect(seriesColor(config, "b")).toBe("var(--chart-2)");
  });

  it("folds a categorical tail into Other instead of a sixth color", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ cat: `c${i}`, n: 10 - i }));
    const folded = foldCategoryTail(rows, { categoryKey: "cat", valueKey: "n", max: 5 });
    expect(folded).toHaveLength(5);
    expect(folded[4].cat).toBe("Other");
    // c4(6) + c5(5) + c6(4)
    expect(folded[4].n).toBe(15);
    // Under the cap nothing moves.
    expect(foldCategoryTail(rows.slice(0, 3), { categoryKey: "cat", valueKey: "n" })).toHaveLength(
      3,
    );
  });

  it("sanitizes series keys into valid CSS custom idents", () => {
    // Data-column names allow what CSS custom idents do not; a clean key
    // stays readable, a dirty one is sanitized (plus a disambiguating
    // hash — see the collision test).
    const vars = chartStyleVars({ tokens: {}, "metrics.tokens": {} });
    expect(vars["--color-tokens"]).toBe("var(--chart-1)");
    const dirty = Object.keys(vars).find((k) => k !== "--color-tokens")!;
    expect(dirty).toMatch(/^--color-metrics-tokens-[a-z0-9]+$/);
  });

  it("keys that sanitize alike still get distinct variables", () => {
    const vars = chartStyleVars({ "metrics.tokens": {}, "metrics tokens": {} });
    expect(Object.keys(vars)).toHaveLength(2);
  });

  it("an existing Other row merges into the fold instead of doubling", () => {
    const rows = [
      { cat: "a", n: 10 },
      { cat: "Other", n: 5 },
      { cat: "b", n: 4 },
      { cat: "c", n: 3 },
    ];
    const folded = foldCategoryTail(rows, { categoryKey: "cat", valueKey: "n", max: 3 });
    expect(folded.filter((r) => r.cat === "Other")).toHaveLength(1);
    // 5 (existing Other) + 4 + 3 — wait: head = a, Other; tail = b, c →
    // kept = [a], folded = Other+b+c = 12.
    expect(folded.find((r) => r.cat === "Other")?.n).toBe(12);
    expect(folded).toHaveLength(2);
  });

  it("a fold cap below two is clamped — one real row plus Other is the floor", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ cat: `c${i}`, n: 4 - i }));
    const folded = foldCategoryTail(rows, { categoryKey: "cat", valueKey: "n", max: 1 });
    expect(folded).toHaveLength(2);
    expect(folded[1].cat).toBe("Other");
    expect(folded[1].n).toBe(3 + 2 + 1);
  });

  it("formats usage-API buckets and passes categories through", () => {
    expect(formatBucketLabel("2026-08-26")).toMatch(/26/);
    expect(formatBucketLabel("2026-08-26T14:00:00+00:00")).toMatch(/\d{1,2}:\d{2}/);
    expect(formatBucketLabel("gpt-5.4")).toBe("gpt-5.4");
  });
});

describe("ChartContainer", () => {
  it("injects one CSS variable per configured series", () => {
    const el = mount(
      <ChartContainer config={{ tokens: {}, runs: { color: "red" } }} responsive={false}>
        <svg />
      </ChartContainer>,
    ).querySelector("[data-chart]") as HTMLElement;
    expect(el.style.getPropertyValue("--color-tokens")).toBe("var(--chart-1)");
    expect(el.style.getPropertyValue("--color-runs")).toBe("red");
  });
});

describe("ChartTooltipContent", () => {
  it("names a row by the payload name first — a donut slice wears its category, never the measure key", () => {
    const el = mount(
      <ChartContainer config={{ tokens: { label: "Tokens" } }} responsive={false}>
        <ChartTooltipContent
          active
          label={null}
          payload={[{ name: "gpt-5.4", dataKey: "tokens", value: 5 }]}
        />
      </ChartContainer>,
    );
    expect(el.textContent).toContain("gpt-5.4");
    expect(el.textContent).not.toContain("Tokens");
  });
});

describe("StatCard", () => {
  it("renders a compact value with a good delta badge", () => {
    const el = mount(
      <StatCard
        label="Total tokens"
        value={1_029_562}
        delta={12.4}
        deltaLabel="vs previous 30 days"
      />,
    );
    expect((el.querySelector("[data-stat-value]") as HTMLElement).textContent).toMatch(
      /1[.,]?0?\s?M/,
    );
    const badge = el.querySelector("[data-stat-delta]") as HTMLElement;
    expect(badge.dataset.statDelta).toBe("good");
    expect(badge.textContent).toContain("12.4");
    expect(el.textContent).toContain("vs previous 30 days");
  });

  it("invertDelta flips which sign reads as good (lower is better)", () => {
    const el = mount(<StatCard label="Failed runs" value={3} delta={-40} invertDelta />);
    expect((el.querySelector("[data-stat-delta]") as HTMLElement).dataset.statDelta).toBe("good");
  });

  it("a positive delta on an inverted metric reads as bad", () => {
    const el = mount(<StatCard label="Failed runs" value={9} delta={40} invertDelta />);
    expect((el.querySelector("[data-stat-delta]") as HTMLElement).dataset.statDelta).toBe("bad");
  });

  it("hint and deltaLabel are independent — both render", () => {
    const el = mount(
      <StatCard
        label="Tokens"
        value={5}
        delta={3}
        hint="chat 4 · runs 1"
        deltaLabel="vs previous 7 days"
      />,
    );
    expect(el.textContent).toContain("chat 4 · runs 1");
    expect(el.textContent).toContain("vs previous 7 days");
  });

  it("loading renders a skeleton, never a fake number", () => {
    const el = mount(<StatCard label="Tokens" value={123} loading />);
    expect(el.querySelector("[data-stat-skeleton]")).toBeTruthy();
    expect(el.querySelector("[data-stat-value]")).toBeNull();
  });
});

const TIMELINE = [
  { bucket: "2026-08-24", chat: 100, workflow: 40 },
  { bucket: "2026-08-25", chat: 160, workflow: 90 },
  { bucket: "2026-08-26", chat: 120, workflow: 70 },
];

describe("TimeSeriesChart", () => {
  it("draws one area per configured series and names them from the config", () => {
    const el = mount(
      <TimeSeriesChart
        data={TIMELINE}
        config={{ chat: { label: "Chat" }, workflow: { label: "Workflows" } }}
        width={600}
        height={240}
      />,
    );
    expect(el.querySelectorAll(".recharts-area")).toHaveLength(2);
    // Legend defaults on for 2 series.
    expect(el.textContent).toContain("Chat");
    expect(el.textContent).toContain("Workflows");
  });

  it("a single series draws without a legend", () => {
    const el = mount(
      <TimeSeriesChart
        data={TIMELINE}
        config={{ chat: { label: "Chat" } }}
        width={600}
        height={240}
      />,
    );
    expect(el.querySelectorAll(".recharts-area")).toHaveLength(1);
    expect(el.querySelector(".recharts-legend-wrapper")).toBeNull();
  });
});

describe("CategoryBarChart", () => {
  it("draws one bar per category and folds the tail via maxBars", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ dept: `Dept ${i}`, tokens: 100 - i }));
    const el = mount(
      <CategoryBarChart
        data={rows}
        categoryKey="dept"
        valueKey="tokens"
        maxBars={5}
        width={600}
        height={240}
      />,
    );
    expect(el.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(5);
    expect(el.textContent).toContain("Other");
  });
});

it("folds by default once a ranked list stops being readable", () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ dept: `D${i}`, n: 20 - i }));
  const el = mount(
    <CategoryBarChart data={rows} categoryKey="dept" valueKey="n" width={600} height={400} />,
  );
  expect(el.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(12);
  expect(el.textContent).toContain("Other");
});

it("colorByCategory honors an explicit config color for the category", () => {
  const rows = [
    { cat: "a", n: 3 },
    { cat: "b", n: 2 },
  ];
  const el = mount(
    <CategoryBarChart
      data={rows}
      categoryKey="cat"
      valueKey="n"
      colorByCategory
      config={{ b: { color: "rgb(1, 2, 3)" } }}
      width={600}
      height={240}
    />,
  );
  const fills = Array.from(
    el.querySelectorAll(".recharts-bar-rectangle path, .recharts-bar-rectangle"),
  ).map(
    (node) =>
      node.getAttribute("fill") ?? (node.firstElementChild as Element | null)?.getAttribute("fill"),
  );
  expect(fills.join(" ")).toContain("rgb(1, 2, 3)");
});

it("ranks an unsorted input before folding, so the biggest bars survive", () => {
  const rows = [
    { cat: "tiny", n: 1 },
    { cat: "huge", n: 100 },
    { cat: "small", n: 2 },
    { cat: "big", n: 50 },
  ];
  const el = mount(
    <CategoryBarChart
      data={rows}
      categoryKey="cat"
      valueKey="n"
      maxBars={2}
      width={600}
      height={240}
    />,
  );
  // huge stays, everything else folds — the fold never eats the leader.
  expect(el.textContent).toContain("huge");
  expect(el.textContent).toContain("Other");
  expect(el.textContent).not.toContain("tiny");
});

describe("DonutChart", () => {
  it("centers the compact total and lists shares in the legend", () => {
    const rows = [
      { model: "gpt-5.4", tokens: 750_000 },
      { model: "claude-fable-5", tokens: 250_000 },
    ];
    const el = mount(
      <DonutChart
        data={rows}
        categoryKey="model"
        valueKey="tokens"
        centerLabel="Tokens"
        width={400}
        height={240}
      />,
    );
    expect((el.querySelector("[data-donut-center]") as HTMLElement).textContent).toMatch(/1\s?M/);
    expect(el.textContent).toContain("75%");
    expect(el.textContent).toContain("25%");
    expect(el.querySelectorAll(".recharts-pie-sector")).toHaveLength(2);
  });

  it("a real sliver reads as <1%, never as absent", () => {
    const rows = [
      { model: "big", tokens: 995 },
      { model: "small", tokens: 5 },
    ];
    const el = mount(
      <DonutChart data={rows} categoryKey="model" valueKey="tokens" width={400} height={240} />,
    );
    expect(el.textContent).toContain("<1%");
  });

  it("folds slice six and beyond into a muted Other", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ model: `m${i}`, tokens: 70 - i * 10 }));
    const el = mount(
      <DonutChart data={rows} categoryKey="model" valueKey="tokens" width={400} height={240} />,
    );
    expect(el.querySelectorAll(".recharts-pie-sector")).toHaveLength(5);
    expect(el.textContent).toContain("Other");
  });
});
