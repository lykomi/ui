import type * as React from "react";

/**
 * Chart semantics — series → label/color resolution and shared formatting.
 *
 * Mirrors the data-table split (`facets.ts` vs `data-table.tsx`): this file
 * owns MEANING — what a series is called, which color identifies it, how a
 * number reads — while `chart.tsx` owns what is drawn. Keeping semantics out
 * of the render tree lets hosts (and agent-written renderers) reason about a
 * chart's contents without rendering it.
 */

export interface ChartSeriesConfig {
  /** Human label shown in legends and tooltips. Falls back to the key. */
  label?: React.ReactNode;
  /**
   * Explicit color — any CSS color, including a theme token reference such
   * as `var(--chart-3)`. When omitted, the series takes the theme's
   * categorical slot for its DECLARED position (see {@link chartSlotColor}).
   */
  color?: string;
}

/**
 * One entry per series/category key. The declaration ORDER is the identity
 * order: colors are assigned by position in this object, so a series keeps
 * its color when a filter removes its neighbours — color follows the entity,
 * never its rank.
 */
export type ChartConfig = Record<string, ChartSeriesConfig>;

/** The theme defines exactly five categorical slots (`--chart-1..5`). */
export const CHART_SLOT_COUNT = 5;

/**
 * The theme's categorical palette, assigned in fixed order. More than five
 * series is a design smell, not a palette problem: fold the tail into
 * "Other" (DonutChart does this via `maxSlices`) or split into small
 * multiples. The modulo below only keeps an overflowing series defined —
 * it is not an invitation to cycle.
 */
export function chartSlotColor(index: number): string {
  return `var(--chart-${(Math.max(0, index) % CHART_SLOT_COUNT) + 1})`;
}

/** Resolved color for a series: explicit config first, theme slot second. */
export function seriesColor(config: ChartConfig, key: string): string {
  const explicit = config[key]?.color;
  if (explicit) return explicit;
  const declaredIndex = Object.keys(config).indexOf(key);
  return chartSlotColor(declaredIndex === -1 ? 0 : declaredIndex);
}

/** The label a folded tail wears, and the muted color that marks it. */
export const OTHER_LABEL = "Other";
export const FOLD_COLOR = "var(--muted-foreground)";

/**
 * The color resolver for a CATEGORICAL chart, where every category is an
 * identity rather than a series.
 *
 * Two requirements pull against each other, and both are real:
 *   - a DECLARED category must keep its color when a filter removes its
 *     neighbours (identity follows the entity, never its rank), and
 *   - a DRAWN category must never take the muted past-the-palette color
 *     just because the config also names categories this chart does not
 *     draw.
 *
 * Resolved by giving each side its own claim on the palette. A declared
 * key OWNS its declared index — reserved whether or not it is drawn, which
 * is what makes it stable — and undeclared drawn categories fill the slots
 * no declaration claimed, in drawn order. Past the palette, or with every
 * slot spoken for, a category takes the muted fold color rather than
 * wrapping modulo five onto a color another category already owns.
 *
 * So: declare the categories whose colors must not move, and the rest sort
 * themselves out.
 *
 * `exclude` drops the measure's own config entry (a bar chart labels its
 * value column there); it is not a category and must not shift the order.
 */
export function categoryColorResolver(
  config: ChartConfig,
  categories: Iterable<string>,
  options: { exclude?: string; otherLabel?: string } = {},
): (category: string) => string {
  const { exclude, otherLabel = OTHER_LABEL } = options;
  const declared = Object.keys(config).filter((key) => key !== exclude && key !== otherLabel);
  const slotOf = new Map<string, number>();
  declared.forEach((key, i) => slotOf.set(key, i));

  // Whatever the declarations did not claim is free for the rest.
  const claimed = new Set(slotOf.values());
  const free: number[] = [];
  for (let slot = 0; slot < CHART_SLOT_COUNT; slot++) {
    if (!claimed.has(slot)) free.push(slot);
  }
  let next = 0;
  for (const category of categories) {
    if (category === otherLabel || slotOf.has(category)) continue;
    const slot = free[next++];
    slotOf.set(category, slot === undefined ? CHART_SLOT_COUNT : slot);
  }

  return (category: string): string => {
    const explicit = config[category]?.color;
    if (explicit) return explicit;
    if (category === otherLabel) return FOLD_COLOR;
    const slot = slotOf.get(category);
    if (slot === undefined || slot >= CHART_SLOT_COUNT) return FOLD_COLOR;
    return chartSlotColor(slot);
  };
}

/** Resolved label for a series: explicit config first, the key itself second. */
export function seriesLabel(config: ChartConfig, key: string): React.ReactNode {
  return config[key]?.label ?? key;
}

/**
 * Series keys are data-column names, which allow characters a CSS custom
 * ident does not (`metrics.tokens`, `model name`). Everything that writes
 * or reads a per-series variable goes through this one sanitizer, so the
 * two sides can never disagree.
 */
export function seriesVarName(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "-");
  if (safe === key) return `--chart-color-${key}`;
  // Two keys may sanitize to the same ident ("metrics.tokens" vs
  // "metrics tokens") — a short stable hash of the RAW key keeps them
  // apart without leaking invalid characters.
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  return `--chart-color-${safe}-${(hash >>> 0).toString(36)}`;
}

/**
 * The `var()` reference marks use for their series color.
 *
 * A key with no configured series resolves to an UNDEFINED custom property,
 * which makes `fill` fall back to black and `stroke` to none — a silent
 * black band. The fallback keeps an undeclared series visible.
 */
export function seriesVar(key: string, fallback = chartSlotColor(0)): string {
  return `var(${seriesVarName(key)}, ${fallback})`;
}

/**
 * The per-series CSS custom properties a `ChartContainer` injects, so chart
 * marks can reference {@link seriesVar} and pick up theme changes live.
 */
export function chartStyleVars(config: ChartConfig): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(config)) {
    vars[seriesVarName(key)] = seriesColor(config, key);
  }
  return vars;
}

const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 1029562 → "1M", 63093480 → "63.1M". For axes and stat tiles. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return compactFormatter.format(value);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Axis label for a time bucket as the usage/statistics APIs emit them:
 * `"2026-08-26"` → localized "Aug 26", an ISO datetime (hour grain) →
 * localized "14:00". Anything else passes through unchanged, so categorical
 * x-axes can share the same formatter.
 */
export function formatBucketLabel(bucket: unknown): string {
  if (typeof bucket !== "string") return String(bucket ?? "");
  if (DATE_ONLY.test(bucket)) {
    const d = new Date(`${bucket}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  const asDate = new Date(bucket);
  if (bucket.includes("T") && !Number.isNaN(asDate.getTime())) {
    return asDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return bucket;
}

/**
 * Fold a category list's tail into a single "Other" row once it exceeds
 * `max` rows — the discipline for categorical charts: a 9th slice is never
 * a 9th color.
 *
 * Ranks by value FIRST. The fold keeps the head, so on an unranked list it
 * would swallow whatever happened to be sorted late — a donut of six
 * equal-ish categories plus one dominant one at the end rendered as four
 * slivers and an unlabeled 96% "Other". Ranking here rather than trusting
 * callers makes that unreachable, including for charts a builder agent
 * writes.
 */
export function foldCategoryTail<T extends Record<string, unknown>>(
  rows: T[],
  options: {
    categoryKey: keyof T & string;
    valueKey: keyof T & string;
    max?: number;
    otherLabel?: string;
  },
): T[] {
  const { categoryKey, valueKey, otherLabel = OTHER_LABEL } = options;
  // A cap below 2 cannot hold a fold (one real row + "Other" is the floor);
  // a non-finite cap would fold everything into a single bucket.
  const requested = options.max ?? CHART_SLOT_COUNT;
  const max = Math.max(2, Number.isFinite(requested) ? requested : CHART_SLOT_COUNT);
  if (rows.length <= max) return rows;
  const ranked = [...rows].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
  // A pre-existing "Other" row always joins the fold, so set it aside
  // BEFORE taking the head: leaving it there would cost a real category
  // its place for a row that gets folded away anyway.
  const existingOther = ranked.filter((row) => String(row[categoryKey]) === otherLabel);
  const real = ranked.filter((row) => String(row[categoryKey]) !== otherLabel);
  const kept = real.slice(0, max - 1);
  const folded = [...existingOther, ...real.slice(max - 1)];
  if (!folded.length) return kept;
  const otherTotal = folded.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0);
  const other = { ...folded[0], [categoryKey]: otherLabel, [valueKey]: otherTotal } as T;
  return [...kept, other];
}
