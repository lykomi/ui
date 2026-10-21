import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GaugeChart } from "../chart.ts";
import { Sparkline } from "../components/chart/sparkline.tsx";
import { StatCard } from "../components/chart/stat-card.tsx";

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(element));
  return container;
}
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("GaugeChart", () => {
  it("scales a custom range, exposes units and positions the target", () => {
    const view = mount(
      <GaugeChart
        label="Temperature"
        min={-20}
        max={80}
        value={30}
        target={30}
        showTargetMarker
        valueFormatter={(n) => `${n}°C`}
      />,
    );
    const meter = view.querySelector('[role="meter"]')!;
    expect(meter.getAttribute("aria-valuenow")).toBe("30");
    expect(meter.getAttribute("aria-valuemin")).toBe("-20");
    expect(meter.getAttribute("aria-valuemax")).toBe("80");
    expect(meter.getAttribute("aria-valuetext")).toBe("30°C; Target: 30°C");
    expect(view.querySelector("[data-gauge-fill]")?.getAttribute("stroke-dasharray")).toBe(
      "50 100",
    );
    expect(Number(view.querySelector("[data-gauge-target]")?.getAttribute("x1"))).toBeCloseTo(120);
  });

  it.each([
    [-10, "0", false],
    [120, "100", true],
  ] as const)("clamps the arc for %s, preserves the actual reading", (value, bounded, fill) => {
    const view = mount(<GaugeChart label="Capacity" value={value} />);
    expect(view.querySelector("[role=meter]")?.getAttribute("aria-valuenow")).toBe(bounded);
    expect(view.querySelector("[role=meter]")?.getAttribute("aria-valuetext")).toBe(String(value));
    expect(Boolean(view.querySelector("[data-gauge-fill]"))).toBe(fill);
  });

  it.each([null, undefined, NaN, Infinity])("does not invent a zero for %s", (value) => {
    const view = mount(<GaugeChart label="Capacity" value={value} />);
    expect(view.querySelector("[role=meter]")).toBeNull();
    expect(view.querySelector("[role=img]")?.getAttribute("aria-label")).toContain("No data");
    expect(view.querySelector("[data-gauge-fill]")).toBeNull();
  });

  it.each([
    [10, 10],
    [10, 0],
    [0, Infinity],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
  ])("rejects invalid range %s to %s", (min, max) => {
    const view = mount(<GaugeChart label="Reading" min={min} max={max} value={5} target={5} />);
    expect(view.querySelector("[role=meter]")).toBeNull();
    expect(view.querySelector("[data-gauge-target]")).toBeNull();
    expect(view.textContent).toContain("No data");
  });

  it("keeps zero as a valid reading and omits out-of-range targets", () => {
    const view = mount(<GaugeChart label="Errors" value={0} target={150} tone="success" />);
    expect(view.querySelector("[role=meter]")?.getAttribute("aria-valuenow")).toBe("0");
    expect(view.querySelector("[data-gauge-target]")).toBeNull();
    expect(view.textContent).not.toContain("Target");
  });

  it("shows target text without a marker by default", () => {
    const view = mount(<GaugeChart label="Delivery" value={92} target={90} />);
    expect(view.querySelector("[data-gauge-target]")).toBeNull();
    expect(view.textContent).toContain("Target: 90");
    expect(view.querySelector("[role=meter]")?.getAttribute("aria-valuetext")).toBe(
      "92; Target: 90",
    );
  });

  it("uses semantic theme tokens and conceals stale readings during refresh", () => {
    const view = mount(<GaugeChart label="Delivery" value={92} tone="success" />);
    expect(view.querySelector("[data-gauge-fill]")?.getAttribute("stroke")).toBe("var(--success)");
    const loading = mount(<GaugeChart label="Delivery" value={92} loading />);
    expect(loading.querySelector("[data-gauge-chart]")?.getAttribute("aria-busy")).toBe("true");
    expect(loading.querySelector("[role=meter]")).toBeNull();
    expect(loading.textContent).toContain("Loading…");
    expect(loading.textContent).not.toContain("92");
  });
});

describe("Sparkline", () => {
  it("breaks the line at missing observations", () => {
    const view = mount(<Sparkline label="Monthly revenue" data={[1, 2, null, 4, NaN, 6]} />);
    const path = view.querySelector("path")!.getAttribute("d")!;
    expect(path.match(/M /g)).toHaveLength(3);
    expect(path.match(/L /g)).toHaveLength(1);
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  it.each([[3], [3, 3, 3], [-Number.MAX_VALUE, Number.MAX_VALUE], []])(
    "renders finite geometry for %j",
    (...values) => {
      const view = mount(<Sparkline label="Trend" data={values} />);
      expect(view.innerHTML).not.toMatch(/NaN|Infinity/);
      if (!values.length)
        expect(view.querySelector("svg")?.getAttribute("aria-label")).toContain("No data");
    },
  );

  it("composes in a KPI card and hides the trend while loading", () => {
    const trend = <Sparkline label="Monthly revenue" data={[1, 2, 3]} />;
    expect(
      mount(<StatCard label="Revenue" value={3} trend={trend} />).querySelector(
        "[data-stat-trend] svg",
      ),
    ).not.toBeNull();
    expect(
      mount(<StatCard label="Revenue" value={3} trend={trend} loading />).querySelector(
        "[data-stat-trend]",
      ),
    ).toBeNull();
  });
});
