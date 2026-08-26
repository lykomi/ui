import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ChartContainer, ChartTooltipContent } from "../components/chart/chart.tsx";
import {
  FOLD_COLOR,
  categoryColorResolver,
  chartSlotColor,
  chartStyleVars,
  foldCategoryTail,
  formatBucketLabel,
  seriesColor,
  seriesVar,
} from "../components/chart/chart-config.ts";
import { ChartCard, DashboardGrid, DashboardTile } from "../components/chart/chart-card.tsx";
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
      "--chart-color-a": "var(--chart-1)",
      "--chart-color-b": "var(--chart-2)",
      "--chart-color-c": "var(--destructive)",
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
    expect(vars["--chart-color-tokens"]).toBe("var(--chart-1)");
    const dirty = Object.keys(vars).find((k) => k !== "--chart-color-tokens")!;
    expect(dirty).toMatch(/^--chart-color-metrics-tokens-[a-z0-9]+$/);
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
    // One Other row, never two.
    expect(folded.filter((r) => r.cat === "Other")).toHaveLength(1);
    // The existing Other is set aside BEFORE the head is taken, so the cap
    // spends its places on real categories: a and b survive, Other carries
    // 5 (the existing one) + 3 (c).
    expect(folded.map((r) => r.cat)).toEqual(["a", "b", "Other"]);
    expect(folded.find((r) => r.cat === "Other")?.n).toBe(8);
  });

  it("an Other row that ranks high does not cost a real category its place", () => {
    const rows = [
      { c: "Other", n: 100 },
      { c: "a", n: 9 },
      { c: "b", n: 8 },
      { c: "d", n: 1 },
    ];
    const folded = foldCategoryTail(rows, { categoryKey: "c", valueKey: "n", max: 3 });
    // Two REAL categories survive; Other carries 100 + 1.
    expect(folded.map((r) => r.c)).toEqual(["a", "b", "Other"]);
    expect(folded[2].n).toBe(101);
  });

  it("a declared category keeps its color when a filter removes its neighbours", () => {
    // The whole point of declaring: identity follows the entity, never its
    // rank. `b` owns slot 2 whether or not `a` is on screen.
    const config = { a: {}, b: {}, c: {} };
    expect(categoryColorResolver(config, ["a", "b", "c"])("b")).toBe(chartSlotColor(1));
    expect(categoryColorResolver(config, ["b"])("b")).toBe(chartSlotColor(1));
  });

  it("undeclared categories fill the slots no declaration claimed", () => {
    // Declarations reserve 0 and 1 (that is what makes them stable), so the
    // undeclared drawn categories take 2 and 3 rather than colliding or
    // being pushed past the palette.
    const resolve = categoryColorResolver({ a: {}, b: {} }, ["a", "x", "y"]);
    expect(resolve("a")).toBe(chartSlotColor(0));
    expect(resolve("x")).toBe(chartSlotColor(2));
    expect(resolve("y")).toBe(chartSlotColor(3));
    expect(new Set([resolve("a"), resolve("x"), resolve("y")]).size).toBe(3);
  });

  it("with every slot declared, an undeclared category is muted, never a duplicate", () => {
    const full = { a: {}, b: {}, c: {}, d: {}, e: {} };
    expect(categoryColorResolver(full, ["a", "zz"])("zz")).toBe(FOLD_COLOR);
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
    expect(el.style.getPropertyValue("--chart-color-tokens")).toBe("var(--chart-1)");
    expect(el.style.getPropertyValue("--chart-color-runs")).toBe("red");
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

describe("the invariants a bot review proved were untested", () => {
  it("the fold ranks first — an unsorted list never loses its leader", () => {
    // The exact rendered failure this replaces: six equal categories plus a
    // dominant one last folded to "a<1% b<1% c<1% d<1% Other 96%".
    const rows = [
      { m: "a", v: 1 },
      { m: "b", v: 1 },
      { m: "c", v: 1 },
      { m: "d", v: 1 },
      { m: "e", v: 1 },
      { m: "DOMINANT", v: 100 },
    ];
    const el = mount(
      <DonutChart data={rows} categoryKey="m" valueKey="v" width={400} height={240} />,
    );
    expect(el.textContent).toContain("DOMINANT");
    expect(el.textContent).toContain("95%");
    // …and "Other" is now what it should always have been: the tail.
    expect(el.textContent).toContain("Other");
  });

  it("a promoted category gets a real color, not the muted past-palette grey", () => {
    // The fold RANKS, so a category sitting last in the input can be drawn
    // first. Resolving identity from input order gave that visible slice
    // slot 6 → the same grey as "Other".
    const rows = [
      { m: "a", v: 1 },
      { m: "b", v: 1 },
      { m: "c", v: 1 },
      { m: "d", v: 1 },
      { m: "e", v: 1 },
      { m: "DOMINANT", v: 100 },
    ];
    const el = mount(
      <DonutChart data={rows} categoryKey="m" valueKey="v" width={400} height={240} />,
    );
    const fills = Array.from(el.querySelectorAll(".recharts-pie-sector path")).map((n) =>
      n.getAttribute("fill"),
    );
    expect(fills[0]).toBe(chartSlotColor(0));
    expect(fills[0]).not.toBe(FOLD_COLOR);
  });

  it("distinct categories never share a color — declared, undeclared, or past the palette", () => {
    const resolve = categoryColorResolver({ b: { label: "B" } }, ["a", "b"]);
    // The old bug: "a" took data index 0 and "b" took config index 0.
    expect(resolve("a")).not.toBe(resolve("b"));
    const many = categoryColorResolver({}, ["c0", "c1", "c2", "c3", "c4", "c5", "c6"]);
    const inPalette = ["c0", "c1", "c2", "c3", "c4"].map(many);
    expect(new Set(inPalette).size).toBe(5);
    // Past the palette a category is muted, never wrapped onto slot 1.
    expect(many("c5")).toBe(FOLD_COLOR);
    expect(many("c5")).not.toBe(chartSlotColor(0));
    // The fold row is always muted, and an explicit color always wins.
    expect(many("Other")).toBe(FOLD_COLOR);
    expect(categoryColorResolver({ a: { color: "rgb(9, 9, 9)" } }, ["a"])("a")).toBe(
      "rgb(9, 9, 9)",
    );
  });

  it("the measure's own config entry does not shift category identity", () => {
    // A bar chart labels its value column in the same config object.
    const withMeasure = categoryColorResolver({ tokens: { label: "Tokens" }, Eng: {} }, ["Eng"], {
      exclude: "tokens",
    });
    expect(withMeasure("Eng")).toBe(chartSlotColor(0));
  });

  it("duplicate category values render without React key collisions", () => {
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
    try {
      mount(
        <DonutChart
          data={[
            { m: "a", v: 1 },
            { m: "a", v: 2 },
            { m: "b", v: 3 },
          ]}
          categoryKey="m"
          valueKey="v"
          width={400}
          height={240}
        />,
      );
    } finally {
      console.error = original;
    }
    expect(errors.filter((e) => String(e).includes("same key"))).toHaveLength(0);
  });

  it("a series color actually reaches the mark it identifies", () => {
    const el = mount(
      <TimeSeriesChart
        data={TIMELINE}
        config={{ chat: {} }}
        kind="line"
        width={600}
        height={240}
      />,
    );
    const curve = el.querySelector(".recharts-line-curve") as SVGElement;
    expect(curve.getAttribute("stroke")).toContain(seriesVar("chat"));
  });

  it("an undeclared series falls back to a visible color, never to black", () => {
    // `var(--chart-color-b)` alone is undefined at computed-value time:
    // fill falls back to black, stroke to none — a silent black band.
    expect(seriesVar("b", chartSlotColor(1))).toBe("var(--chart-color-b, var(--chart-2))");
    const el = mount(
      <TimeSeriesChart
        data={TIMELINE}
        config={{ chat: {} }}
        series={["chat", "workflow"]}
        width={600}
        height={240}
      />,
    );
    const areas = Array.from(el.querySelectorAll(".recharts-area-area"));
    expect(areas[1]?.getAttribute("fill")).toContain("var(--chart-2)");
  });

  it("the responsive path — what every real consumer renders — mounts a container", () => {
    // Every other test passes `width`, which takes the fixed branch; the
    // default branch went unexercised entirely.
    const el = mount(<TimeSeriesChart data={TIMELINE} config={{ chat: {} }} />);
    expect(el.querySelector(".recharts-responsive-container")).toBeTruthy();
    // The wrapper states an explicit height, so the aspect ratio yields.
    expect((el.querySelector("[data-chart]") as HTMLElement).style.height).toBe("240px");
  });

  it("formats a bucket label rather than passing it through", () => {
    // The previous assertions (/26/, /\d{1,2}:\d{2}/) all held for the
    // identity function, so the whole formatter was unverified.
    // Locale-independent: the formatter is deliberately locale-aware
    // (`toLocaleDateString(undefined, …)`), so assert it FORMATTED rather
    // than pinning en-US output a de-DE contributor would fail on.
    const day = formatBucketLabel("2026-08-26");
    expect(day).not.toBe("2026-08-26");
    expect(day).toBe(
      new Date("2026-08-26T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    );
    const hour = formatBucketLabel("2026-08-26T14:00:00+00:00");
    expect(hour).not.toBe("2026-08-26T14:00:00+00:00");
    expect(hour).toBe(
      new Date("2026-08-26T14:00:00+00:00").toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ); // TZ is pinned to America/Los_Angeles
  });

  it("a zero delta is neutral, and a non-finite one shows no badge at all", () => {
    const flat = mount(<StatCard label="Tokens" value={5} delta={0} />);
    expect((flat.querySelector("[data-stat-delta]") as HTMLElement).dataset.statDelta).toBe("flat");
    // Infinity is what (now - 0) / 0 produces; "▲ ∞%" as GOOD is worse than
    // no badge.
    const infinite = mount(<StatCard label="Tokens" value={5} delta={Infinity} />);
    expect(infinite.querySelector("[data-stat-delta]")).toBeNull();
    const nan = mount(<StatCard label="Tokens" value={5} delta={NaN} />);
    expect(nan.querySelector("[data-stat-delta]")).toBeNull();
  });

  it("a non-finite value reads the same in both formats", () => {
    const compact = mount(<StatCard label="a" value={NaN} />);
    const plain = mount(<StatCard label="a" value={NaN} format="plain" />);
    expect((compact.querySelector("[data-stat-value]") as HTMLElement).textContent).toBe("–");
    expect((plain.querySelector("[data-stat-value]") as HTMLElement).textContent).toBe("–");
  });

  it("a NaN cap folds nothing away", () => {
    const rows = [
      { c: "a", n: 3 },
      { c: "b", n: 2 },
      { c: "c", n: 1 },
    ];
    expect(
      foldCategoryTail(rows, { categoryKey: "c", valueKey: "n", max: Number.NaN }),
    ).toHaveLength(3);
  });

  it("the dashboard anatomy renders its parts", () => {
    const el = mount(
      <DashboardGrid columns={3}>
        <DashboardTile span={2}>
          <ChartCard title="Tokens" description="per day" footer="all-time">
            <div data-body="" />
          </ChartCard>
        </DashboardTile>
      </DashboardGrid>,
    );
    expect(el.querySelector("[data-dashboard-grid]")).toBeTruthy();
    expect((el.querySelector("[data-dashboard-grid]") as HTMLElement).className).toContain(
      "lg:grid-cols-3",
    );
    expect(el.querySelector("[data-chart-card]")).toBeTruthy();
    expect(el.textContent).toContain("Tokens");
    expect(el.textContent).toContain("per day");
    expect(el.textContent).toContain("all-time");
    expect(el.querySelector("[data-body]")).toBeTruthy();
  });
});
