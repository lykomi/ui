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
  if (safe === key) return `--color-${key}`;
  // Two keys may sanitize to the same ident ("metrics.tokens" vs
  // "metrics tokens") — a short stable hash of the RAW key keeps them
  // apart without leaking invalid characters.
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  return `--color-${safe}-${(hash >>> 0).toString(36)}`;
}

/** The `var(--color-<key>)` reference marks use for their series color. */
export function seriesVar(key: string): string {
  return `var(${seriesVarName(key)})`;
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
 * Fold a sorted category list's tail into a single "Other" row once it
 * exceeds `max` rows — the discipline for categorical charts: a 9th slice
 * is never a 9th color.
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
  const { categoryKey, valueKey, otherLabel = "Other" } = options;
  // A cap below 2 cannot hold a fold (one real row + "Other" is the floor).
  const max = Math.max(2, options.max ?? CHART_SLOT_COUNT);
  if (rows.length <= max) return rows;
  const head = rows.slice(0, max - 1);
  const tail = rows.slice(max - 1);
  // A pre-existing "Other" row in the head merges into the fold — two
  // rows wearing the same label would double the category.
  const kept = head.filter((row) => String(row[categoryKey]) !== otherLabel);
  const folded = [...head.filter((row) => String(row[categoryKey]) === otherLabel), ...tail];
  const otherTotal = folded.reduce((sum, row) => sum + (Number(row[valueKey]) || 0), 0);
  const other = {
    ...(tail[0] ?? folded[0]),
    [categoryKey]: otherLabel,
    [valueKey]: otherTotal,
  } as T;
  return [...kept, other];
}
