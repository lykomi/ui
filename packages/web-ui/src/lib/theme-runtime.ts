import type { CSSProperties } from "react";
import type { ThemeMode } from "./theme-store.ts";

export interface ThemeColorSlots {
  background?: string;
  foreground?: string;
  /** Page and document headings, independent of body text and action colours. */
  heading?: string;
  /** Heading colours inside authored content, independent of application chrome. */
  contentHeading1?: string;
  contentHeading2?: string;
  contentHeading3?: string;
  contentHeading4?: string;
  contentHeading5?: string;
  contentHeading6?: string;
  card?: string;
  cardForeground?: string;
  popover?: string;
  popoverForeground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  destructive?: string;
  destructiveForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
}

export interface ThemeSidebarSlots {
  sidebar?: string;
  sidebarForeground?: string;
  sidebarPrimary?: string;
  sidebarPrimaryForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarSelected?: string;
  sidebarSelectedForeground?: string;
  /**
   * Colour of the icons in the sidebar's idle rows.
   *
   * Separate from `sidebarForeground` because a brand whose mark is a colour
   * usually wants the icons in that colour and the LABELS still readable —
   * tinting `sidebarForeground` to reach the icons drags every label with it.
   * Unset resolves to the previous behaviour (the label colour at 60%), so no
   * existing theme moves.
   */
  sidebarIcon?: string;
  sidebarBorder?: string;
  sidebarRing?: string;
}

export interface ThemeStatusSlots {
  success?: string;
  successForeground?: string;
  warning?: string;
  warningForeground?: string;
  info?: string;
  infoForeground?: string;
  syntaxKey?: string;
  syntaxString?: string;
  syntaxNumber?: string;
  syntaxBoolean?: string;
}

export interface ThemeChartSlots {
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
}

export interface ThemeTypographySlots {
  bodyFont?: string;
  headingFont?: string;
  monoFont?: string;
}

export interface ThemeRadiusSlots {
  radius?: string;
}

export interface ThemeAppSlots {
  codeBlock?: string;
  codeBlockForeground?: string;
  workflowDiagramSurface?: string;
  workflowDiagramLine?: string;
  workflowDiagramText?: string;
  workflowDiagramBorder?: string;
  workflowDiagramCompletedStroke?: string;
  workflowDiagramCompletedText?: string;
  workflowDiagramActiveFill?: string;
  workflowDiagramActiveStroke?: string;
  workflowDiagramActiveText?: string;
  workflowDiagramFailedFill?: string;
  workflowDiagramFailedStroke?: string;
  workflowDiagramFailedText?: string;
  workflowDiagramSkippedFill?: string;
  workflowDiagramSkippedStroke?: string;
  workflowDiagramSkippedText?: string;
  workflowDiagramGlow?: string;
  workflowDiagramShell?: string;
}

export interface ThemeBranding {
  appName?: string;
  appTitle?: string;
  /**
   * Full wordmark — an image that already spells the brand out. Rendered on
   * its own, because setting it beside `appName` prints the brand twice.
   */
  logoUrl?: string;
  darkLogoUrl?: string;
  /**
   * Compact mark (square-ish glyph, no words). Rendered *with* `appName`
   * beside it, so a tenant can show "<mark> Product Name" — the usual answer
   * when the product name differs from the company name. Takes precedence
   * over `logoUrl` when both are set, since supplying an icon is an explicit
   * request for the lockup.
   */
  iconUrl?: string;
  darkIconUrl?: string;
  /** Browser tab icon; falls back to the compact brand icon when unset. */
  faviconUrl?: string;
  darkFaviconUrl?: string;
  /** Square PNG recommended for mobile home-screen bookmarks. */
  touchIconUrl?: string;
  /**
   * Rendered height of the mark, as a CSS length (`"2rem"`, `"32px"`).
   * Defaults to the 20px lockup height when unset.
   *
   * A wordmark is not interchangeable with an icon at one fixed height. Marks
   * that carry a tagline under the name — a common wordmark shape — turn the
   * tagline into an unreadable smear at 20px, and the whole lockup reads as
   * undersized next to the product name. The tenant supplying the asset is the
   * only one who knows how much height it needs, so this is theirs to set.
   *
   * Validated, not interpolated blindly: the value reaches an inline style and
   * themes are tenant-authored content, so anything that is not a plain
   * non-negative CSS length in px/rem/em is ignored in favour of the default.
   */
  logoHeight?: string;
}

export interface ThemeDefinition {
  light?: ThemeColorSlots;
  dark?: ThemeColorSlots;
  sidebar?: {
    light?: ThemeSidebarSlots;
    dark?: ThemeSidebarSlots;
  };
  status?: {
    light?: ThemeStatusSlots;
    dark?: ThemeStatusSlots;
  };
  charts?: {
    light?: ThemeChartSlots;
    dark?: ThemeChartSlots;
  };
  typography?: ThemeTypographySlots;
  radius?: ThemeRadiusSlots;
  app?: {
    light?: ThemeAppSlots;
    dark?: ThemeAppSlots;
  };
  branding?: ThemeBranding;
}

export interface ThemeLayer {
  id?: string;
  name?: string;
  basePreset?: string | null;
  definition?: ThemeDefinition | null;
}

export interface ResolvedThemeRuntime {
  mode: "light" | "dark";
  definition: ThemeDefinition;
  branding: ThemeBranding;
  variables: CSSProperties;
  sources: ThemeLayer[];
}

const COLOR_KEYS = [
  "primary",
  "primaryForeground",
  "heading",
  "contentHeading1",
  "contentHeading2",
  "contentHeading3",
  "contentHeading4",
  "contentHeading5",
  "contentHeading6",
  "background",
  "foreground",
  "accent",
  "accentForeground",
  "card",
  "cardForeground",
  "border",
  "ring",
  "input",
  "muted",
  "mutedForeground",
  "secondary",
  "secondaryForeground",
  "popover",
  "popoverForeground",
  "destructive",
  "destructiveForeground",
] as const satisfies readonly (keyof ThemeColorSlots)[];

const SIDEBAR_KEYS = [
  "sidebarSelected",
  "sidebarSelectedForeground",
  "sidebar",
  "sidebarForeground",
  "sidebarPrimary",
  "sidebarPrimaryForeground",
  "sidebarIcon",
  "sidebarAccent",
  "sidebarAccentForeground",
  "sidebarBorder",
  "sidebarRing",
] as const satisfies readonly (keyof ThemeSidebarSlots)[];

const STATUS_KEYS = [
  "success",
  "successForeground",
  "warning",
  "warningForeground",
  "info",
  "infoForeground",
  "syntaxKey",
  "syntaxString",
  "syntaxNumber",
  "syntaxBoolean",
] as const satisfies readonly (keyof ThemeStatusSlots)[];

const CHART_KEYS = [
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
] as const satisfies readonly (keyof ThemeChartSlots)[];

const TYPOGRAPHY_KEYS = [
  "bodyFont",
  "headingFont",
  "monoFont",
] as const satisfies readonly (keyof ThemeTypographySlots)[];

const RADIUS_KEYS = ["radius"] as const satisfies readonly (keyof ThemeRadiusSlots)[];

const APP_KEYS = [
  "codeBlock",
  "codeBlockForeground",
  "workflowDiagramSurface",
  "workflowDiagramLine",
  "workflowDiagramText",
  "workflowDiagramBorder",
  "workflowDiagramCompletedStroke",
  "workflowDiagramCompletedText",
  "workflowDiagramActiveFill",
  "workflowDiagramActiveStroke",
  "workflowDiagramActiveText",
  "workflowDiagramFailedFill",
  "workflowDiagramFailedStroke",
  "workflowDiagramFailedText",
  "workflowDiagramSkippedFill",
  "workflowDiagramSkippedStroke",
  "workflowDiagramSkippedText",
  "workflowDiagramGlow",
  "workflowDiagramShell",
] as const satisfies readonly (keyof ThemeAppSlots)[];

const BRANDING_KEYS = [
  "appName",
  "appTitle",
  "logoUrl",
  "darkLogoUrl",
  "iconUrl",
  "darkIconUrl",
  "faviconUrl",
  "darkFaviconUrl",
  "touchIconUrl",
  "logoHeight",
] as const satisfies readonly (keyof ThemeBranding)[];

export interface ThemeSlot {
  path: readonly string[];
  label: string;
  group: string;
  kind: "color" | "font" | "length" | "text" | "image";
  cssVariable?: string;
  mode?: "light" | "dark";
  /** Lower values appear first in authoring tools. */
  impact: number;
  /** Human-readable source used when this value is not explicitly set. */
  derivedFrom?: string;
}

const SURFACE_IMPACT: Record<(typeof COLOR_KEYS)[number], number> = Object.fromEntries(
  COLOR_KEYS.map((key, index) => [key, index]),
) as Record<(typeof COLOR_KEYS)[number], number>;

const SURFACE_DERIVATIONS: Partial<Record<(typeof COLOR_KEYS)[number], string>> = {
  heading: "foreground",
  contentHeading1: "interface heading",
  contentHeading2: "interface heading + foreground",
  contentHeading3: "foreground",
  contentHeading4: "foreground",
  contentHeading5: "foreground",
  contentHeading6: "foreground",
  card: "background",
  cardForeground: "foreground",
  popover: "card",
  popoverForeground: "foreground",
  secondary: "background + primary",
  secondaryForeground: "foreground",
  muted: "background + foreground",
  mutedForeground: "foreground + background",
  accent: "background + primary",
  accentForeground: "foreground",
  border: "foreground + background",
  input: "border",
  ring: "primary",
};

const cssName = (key: string) =>
  `--${key.replace(/[A-Z0-9]/g, (part) => `-${part.toLowerCase()}`)}`;
const slotLabel = (key: string) =>
  (
    ({
      heading: "Interface headings",
      contentHeading1: "H1",
      contentHeading2: "H2",
      contentHeading3: "H3",
      contentHeading4: "H4",
      contentHeading5: "H5",
      contentHeading6: "H6",
      sidebarSelected: "Selected background",
      sidebarSelectedForeground: "Selected text",
    }) as Record<string, string>
  )[key] ?? key.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** The same allowlists power sanitization and authoring: supported slots cannot disappear from editors. */
export const THEME_SLOTS: readonly ThemeSlot[] = [
  ...(["light", "dark"] as const).flatMap((mode): ThemeSlot[] => [
    ...COLOR_KEYS.map((key) => ({
      path: [mode, key],
      label: slotLabel(key),
      group: key.startsWith("contentHeading") ? "Content" : "Surfaces",
      kind: "color" as const,
      cssVariable: cssName(key),
      mode,
      impact: SURFACE_IMPACT[key],
      derivedFrom: SURFACE_DERIVATIONS[key],
    })),
    ...(
      [
        ["sidebar", SIDEBAR_KEYS, "Navigation"],
        ["status", STATUS_KEYS, "Signals"],
        ["charts", CHART_KEYS, "Charts"],
        ["app", APP_KEYS, "Code & workflows"],
      ] as const
    ).flatMap(([section, keys, group]) =>
      keys.map((key, impact) => ({
        path: [section, mode, key],
        label: slotLabel(key),
        group,
        kind: "color" as const,
        cssVariable: cssName(key),
        mode,
        impact,
        derivedFrom:
          group === "Navigation"
            ? "page colours"
            : group === "Signals" && String(key).startsWith("info")
              ? "primary action"
              : group === "Code & workflows"
                ? "page and signal colours"
                : undefined,
      })),
    ),
  ]),
  ...TYPOGRAPHY_KEYS.map((key): ThemeSlot => ({
    path: ["typography", key],
    label: slotLabel(key),
    group: "Typography & shape",
    kind: "font",
    cssVariable: `--font-${key.replace("Font", "")}`,
    impact: key === "headingFont" ? 0 : key === "bodyFont" ? 1 : 3,
  })),
  ...RADIUS_KEYS.map((key): ThemeSlot => ({
    path: ["radius", key],
    label: "Corner radius",
    group: "Typography & shape",
    kind: "length",
    cssVariable: cssName(key),
    impact: 2,
  })),
  ...BRANDING_KEYS.map((key): ThemeSlot => ({
    path: ["branding", key],
    label: slotLabel(key),
    group: "Brand",
    kind: key.endsWith("Url") ? "image" : key === "logoHeight" ? "length" : "text",
    impact: BRANDING_KEYS.indexOf(key),
  })),
];

function cleanObject<T extends object>(
  value: unknown,
  keys: readonly (keyof T)[],
): Partial<T> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const next: Partial<T> = {};
  for (const key of keys) {
    const raw = (value as Record<string, unknown>)[key as string];
    if (typeof raw === "string" && raw.trim()) {
      next[key] = raw.trim() as T[keyof T];
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeThemeDefinition(value: ThemeDefinition | null | undefined): ThemeDefinition {
  if (!value || typeof value !== "object") return {};
  return {
    light: cleanObject<ThemeColorSlots>(value.light, COLOR_KEYS),
    dark: cleanObject<ThemeColorSlots>(value.dark, COLOR_KEYS),
    sidebar: {
      light: cleanObject<ThemeSidebarSlots>(value.sidebar?.light, SIDEBAR_KEYS),
      dark: cleanObject<ThemeSidebarSlots>(value.sidebar?.dark, SIDEBAR_KEYS),
    },
    status: {
      light: cleanObject<ThemeStatusSlots>(value.status?.light, STATUS_KEYS),
      dark: cleanObject<ThemeStatusSlots>(value.status?.dark, STATUS_KEYS),
    },
    charts: {
      light: cleanObject<ThemeChartSlots>(value.charts?.light, CHART_KEYS),
      dark: cleanObject<ThemeChartSlots>(value.charts?.dark, CHART_KEYS),
    },
    typography: cleanObject<ThemeTypographySlots>(value.typography, TYPOGRAPHY_KEYS),
    radius: cleanObject<ThemeRadiusSlots>(value.radius, RADIUS_KEYS),
    app: {
      light: cleanObject<ThemeAppSlots>(value.app?.light, APP_KEYS),
      dark: cleanObject<ThemeAppSlots>(value.app?.dark, APP_KEYS),
    },
    branding: cleanObject<ThemeBranding>(value.branding, BRANDING_KEYS),
  };
}

function mergePartial<T extends object>(
  base: T | undefined,
  patch: Partial<T> | undefined,
): T | undefined {
  if (!base && !patch) return undefined;
  return { ...(base ?? {}), ...(patch ?? {}) } as T;
}

export function mergeThemeDefinitions(
  ...definitions: (ThemeDefinition | null | undefined)[]
): ThemeDefinition {
  let current: ThemeDefinition = {};
  for (const raw of definitions) {
    const next = sanitizeThemeDefinition(raw);
    current = {
      light: mergePartial(current.light, next.light),
      dark: mergePartial(current.dark, next.dark),
      sidebar: {
        light: mergePartial(current.sidebar?.light, next.sidebar?.light),
        dark: mergePartial(current.sidebar?.dark, next.sidebar?.dark),
      },
      status: {
        light: mergePartial(current.status?.light, next.status?.light),
        dark: mergePartial(current.status?.dark, next.status?.dark),
      },
      charts: {
        light: mergePartial(current.charts?.light, next.charts?.light),
        dark: mergePartial(current.charts?.dark, next.charts?.dark),
      },
      typography: mergePartial(current.typography, next.typography),
      radius: mergePartial(current.radius, next.radius),
      app: {
        light: mergePartial(current.app?.light, next.app?.light),
        dark: mergePartial(current.app?.dark, next.app?.dark),
      },
      branding: mergePartial(current.branding, next.branding),
    };
  }
  return current;
}

function toCssVars(
  colors: ThemeColorSlots,
  sidebar: ThemeSidebarSlots,
  status: ThemeStatusSlots,
  charts: ThemeChartSlots,
  typography: ThemeTypographySlots,
  radius: ThemeRadiusSlots,
  app: ThemeAppSlots,
): CSSProperties {
  return {
    ["--background" as string]: colors.background,
    ["--foreground" as string]: colors.foreground,
    ["--heading" as string]: colors.heading ?? colors.foreground,
    ["--content-heading-1" as string]: colors.contentHeading1,
    ["--content-heading-2" as string]: colors.contentHeading2,
    ["--content-heading-3" as string]: colors.contentHeading3,
    ["--content-heading-4" as string]: colors.contentHeading4,
    ["--content-heading-5" as string]: colors.contentHeading5,
    ["--content-heading-6" as string]: colors.contentHeading6,
    ["--card" as string]: colors.card,
    ["--card-foreground" as string]: colors.cardForeground,
    ["--popover" as string]: colors.popover,
    ["--popover-foreground" as string]: colors.popoverForeground,
    ["--primary" as string]: colors.primary,
    ["--primary-foreground" as string]: colors.primaryForeground,
    ["--secondary" as string]: colors.secondary,
    ["--secondary-foreground" as string]: colors.secondaryForeground,
    ["--muted" as string]: colors.muted,
    ["--muted-foreground" as string]: colors.mutedForeground,
    ["--accent" as string]: colors.accent,
    ["--accent-foreground" as string]: colors.accentForeground,
    ["--destructive" as string]: colors.destructive,
    ["--destructive-foreground" as string]: colors.destructiveForeground,
    ["--border" as string]: colors.border,
    ["--input" as string]: colors.input,
    ["--ring" as string]: colors.ring,
    ["--sidebar" as string]: sidebar.sidebar,
    ["--sidebar-foreground" as string]: sidebar.sidebarForeground,
    ["--sidebar-primary" as string]: sidebar.sidebarPrimary,
    ["--sidebar-primary-foreground" as string]: sidebar.sidebarPrimaryForeground,
    ["--sidebar-accent" as string]: sidebar.sidebarAccent,
    ["--sidebar-accent-foreground" as string]: sidebar.sidebarAccentForeground,
    ["--sidebar-selected" as string]: sidebar.sidebarSelected,
    ["--sidebar-selected-foreground" as string]: sidebar.sidebarSelectedForeground,
    ["--sidebar-icon" as string]: sidebar.sidebarIcon,
    ["--sidebar-border" as string]: sidebar.sidebarBorder,
    ["--sidebar-ring" as string]: sidebar.sidebarRing,
    ["--success" as string]: status.success,
    ["--success-foreground" as string]: status.successForeground,
    ["--warning" as string]: status.warning,
    ["--warning-foreground" as string]: status.warningForeground,
    ["--info" as string]: status.info,
    ["--info-foreground" as string]: status.infoForeground,
    ["--syntax-key" as string]: status.syntaxKey,
    ["--syntax-string" as string]: status.syntaxString,
    ["--syntax-number" as string]: status.syntaxNumber,
    ["--syntax-boolean" as string]: status.syntaxBoolean,
    ["--chart-1" as string]: charts.chart1,
    ["--chart-2" as string]: charts.chart2,
    ["--chart-3" as string]: charts.chart3,
    ["--chart-4" as string]: charts.chart4,
    ["--chart-5" as string]: charts.chart5,
    ["--font-body" as string]: typography.bodyFont,
    ["--font-heading" as string]: typography.headingFont,
    ["--font-mono" as string]: typography.monoFont,
    ["--radius" as string]: radius.radius,
    ["--code-block" as string]: app.codeBlock,
    ["--code-block-foreground" as string]: app.codeBlockForeground,
    ["--workflow-diagram-surface" as string]: app.workflowDiagramSurface,
    ["--workflow-diagram-line" as string]: app.workflowDiagramLine,
    ["--workflow-diagram-text" as string]: app.workflowDiagramText,
    ["--workflow-diagram-border" as string]: app.workflowDiagramBorder,
    ["--workflow-diagram-completed-stroke" as string]: app.workflowDiagramCompletedStroke,
    ["--workflow-diagram-completed-text" as string]: app.workflowDiagramCompletedText,
    ["--workflow-diagram-active-fill" as string]: app.workflowDiagramActiveFill,
    ["--workflow-diagram-active-stroke" as string]: app.workflowDiagramActiveStroke,
    ["--workflow-diagram-active-text" as string]: app.workflowDiagramActiveText,
    ["--workflow-diagram-failed-fill" as string]: app.workflowDiagramFailedFill,
    ["--workflow-diagram-failed-stroke" as string]: app.workflowDiagramFailedStroke,
    ["--workflow-diagram-failed-text" as string]: app.workflowDiagramFailedText,
    ["--workflow-diagram-skipped-fill" as string]: app.workflowDiagramSkippedFill,
    ["--workflow-diagram-skipped-stroke" as string]: app.workflowDiagramSkippedStroke,
    ["--workflow-diagram-skipped-text" as string]: app.workflowDiagramSkippedText,
    ["--workflow-diagram-glow" as string]: app.workflowDiagramGlow,
    ["--workflow-diagram-shell" as string]: app.workflowDiagramShell,
  };
}

export function getEffectiveThemeMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function defaultSidebar(colors: ThemeColorSlots): ThemeSidebarSlots {
  return {
    sidebar: colors.secondary!,
    sidebarForeground: colors.foreground!,
    sidebarPrimary: colors.primary!,
    sidebarPrimaryForeground: colors.primaryForeground!,
    sidebarAccent: colors.accent!,
    sidebarAccentForeground: colors.accentForeground!,
    sidebarSelected: colors.muted!,
    sidebarSelectedForeground: colors.foreground!,
    sidebarIcon: "color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)",
    sidebarBorder: colors.border!,
    sidebarRing: colors.ring!,
  };
}

function defaultStatus(mode: "light" | "dark", colors: ThemeColorSlots): ThemeStatusSlots {
  if (mode === "dark") {
    return {
      success: "oklch(0.72 0.14 155)",
      successForeground: "oklch(0.16 0.01 155)",
      warning: "oklch(0.72 0.13 84)",
      warningForeground: "oklch(0.2 0.03 84)",
      info: colors.primary!,
      infoForeground: colors.primaryForeground!,
      syntaxKey: "oklch(0.8 0.12 286)",
      syntaxString: "oklch(0.82 0.12 155)",
      syntaxNumber: "oklch(0.78 0.14 245)",
      syntaxBoolean: "oklch(0.79 0.15 84)",
    };
  }
  return {
    success: "oklch(0.58 0.16 155)",
    successForeground: "oklch(1 0 0)",
    warning: "oklch(0.72 0.16 84)",
    warningForeground: "oklch(0.3 0.05 84)",
    info: colors.primary!,
    infoForeground: colors.primaryForeground!,
    syntaxKey: "oklch(0.48 0.17 286)",
    syntaxString: "oklch(0.5 0.15 155)",
    syntaxNumber: "oklch(0.52 0.16 245)",
    syntaxBoolean: "oklch(0.58 0.15 84)",
  };
}

function defaultCharts(mode: "light" | "dark"): ThemeChartSlots {
  if (mode === "dark") {
    return {
      chart1: "oklch(0.72 0.17 286)",
      chart2: "oklch(0.74 0.13 240)",
      chart3: "oklch(0.76 0.12 195)",
      chart4: "oklch(0.79 0.15 84)",
      chart5: "oklch(0.74 0.14 20)",
    };
  }
  return {
    chart1: "oklch(0.55 0.19 286)",
    chart2: "oklch(0.56 0.15 240)",
    chart3: "oklch(0.58 0.13 195)",
    chart4: "oklch(0.7 0.16 84)",
    chart5: "oklch(0.63 0.17 20)",
  };
}

function defaultApp(mode: "light" | "dark", colors: ThemeColorSlots): ThemeAppSlots {
  if (mode === "dark") {
    return {
      codeBlock: "oklch(0.16 0.01 286)",
      codeBlockForeground: "oklch(0.92 0.01 286)",
      workflowDiagramSurface: "color-mix(in srgb, var(--background) 84%, var(--primary) 16%)",
      workflowDiagramLine: "color-mix(in srgb, var(--primary) 90%, white 10%)",
      workflowDiagramText: "oklch(0.95 0.01 286)",
      workflowDiagramBorder: "color-mix(in srgb, var(--primary) 34%, var(--border) 66%)",
      workflowDiagramCompletedStroke: "color-mix(in srgb, var(--success) 82%, var(--primary) 18%)",
      workflowDiagramCompletedText: "color-mix(in srgb, var(--foreground) 76%, var(--success) 24%)",
      workflowDiagramActiveFill: "color-mix(in srgb, var(--background) 76%, var(--primary) 24%)",
      workflowDiagramActiveStroke: "color-mix(in srgb, var(--primary) 92%, white 8%)",
      workflowDiagramActiveText: "oklch(0.95 0.01 286)",
      workflowDiagramFailedFill:
        "color-mix(in srgb, var(--destructive) 22%, var(--background) 78%)",
      workflowDiagramFailedStroke: colors.destructive!,
      workflowDiagramFailedText: "color-mix(in srgb, var(--destructive) 58%, white 42%)",
      workflowDiagramSkippedFill: "color-mix(in srgb, var(--muted) 80%, var(--background) 20%)",
      workflowDiagramSkippedStroke: "color-mix(in srgb, var(--muted-foreground) 36%, transparent)",
      workflowDiagramSkippedText: colors.mutedForeground!,
      workflowDiagramGlow: "color-mix(in srgb, var(--primary) 18%, transparent)",
      workflowDiagramShell: "color-mix(in srgb, var(--primary) 6%, transparent)",
    };
  }
  return {
    codeBlock: "oklch(0.2 0 0)",
    codeBlockForeground: "oklch(0.93 0 0)",
    workflowDiagramSurface: "color-mix(in srgb, var(--background) 95%, var(--primary) 5%)",
    workflowDiagramLine: "color-mix(in srgb, var(--primary) 84%, var(--foreground) 16%)",
    workflowDiagramText: "color-mix(in srgb, var(--foreground) 88%, var(--primary) 12%)",
    workflowDiagramBorder: "color-mix(in srgb, var(--primary) 18%, var(--border) 82%)",
    workflowDiagramCompletedStroke: "color-mix(in srgb, var(--success) 78%, var(--primary) 22%)",
    workflowDiagramCompletedText: "color-mix(in srgb, var(--foreground) 82%, var(--success) 18%)",
    workflowDiagramActiveFill: "color-mix(in srgb, var(--background) 90%, var(--primary) 10%)",
    workflowDiagramActiveStroke: colors.primary!,
    workflowDiagramActiveText: "color-mix(in srgb, var(--foreground) 86%, var(--primary) 14%)",
    workflowDiagramFailedFill: "color-mix(in srgb, var(--destructive) 8%, var(--background) 92%)",
    workflowDiagramFailedStroke: colors.destructive!,
    workflowDiagramFailedText: "color-mix(in srgb, var(--destructive) 62%, var(--foreground) 38%)",
    workflowDiagramSkippedFill: "color-mix(in srgb, var(--muted) 65%, var(--background) 35%)",
    workflowDiagramSkippedStroke: "color-mix(in srgb, var(--muted-foreground) 22%, transparent)",
    workflowDiagramSkippedText: colors.mutedForeground!,
    workflowDiagramGlow: "color-mix(in srgb, var(--primary) 18%, transparent)",
    workflowDiagramShell: "color-mix(in srgb, var(--primary) 4%, transparent)",
  };
}

export const FOUNDRY_VIOLET_THEME: ThemeDefinition = {
  light: {
    background: "oklch(100% 0 0)",
    foreground: "oklch(21% 0.006 290)",
    card: "oklch(100% 0 0)",
    cardForeground: "oklch(21% 0.006 290)",
    popover: "oklch(100% 0 0)",
    popoverForeground: "oklch(21% 0.006 290)",
    primary: "oklch(43% 0.24 286)",
    primaryForeground: "oklch(100% 0 0)",
    secondary: "oklch(96% 0.015 290)",
    secondaryForeground: "oklch(35% 0.15 290)",
    muted: "oklch(98% 0 0)",
    mutedForeground: "oklch(45% 0.01 290)",
    accent: "oklch(96% 0.02 290)",
    accentForeground: "oklch(30% 0.1 290)",
    destructive: "oklch(55% 0.18 15)",
    destructiveForeground: "oklch(100% 0 0)",
    border: "oklch(92% 0.008 290)",
    input: "oklch(92% 0.008 290)",
    ring: "oklch(43% 0.24 286)",
  },
  sidebar: {
    light: {
      sidebar: "oklch(99.2% 0 0)",
      sidebarForeground: "oklch(24% 0.004 286)",
      sidebarPrimary: "oklch(43% 0.24 286)",
      sidebarPrimaryForeground: "oklch(100% 0 0)",
      sidebarAccent: "color-mix(in srgb, var(--primary) 4%, var(--background) 96%)",
      sidebarAccentForeground: "color-mix(in srgb, var(--foreground) 92%, var(--primary) 8%)",
      sidebarSelected: "var(--muted)",
      sidebarSelectedForeground: "var(--foreground)",
      sidebarIcon: "color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)",
      sidebarBorder: "color-mix(in srgb, var(--border) 96%, var(--foreground) 4%)",
      sidebarRing: "oklch(43% 0.24 286)",
    },
    dark: {
      sidebar: "oklch(0.18 0.004 286)",
      sidebarForeground: "oklch(0.94 0.004 286)",
      sidebarPrimary: "oklch(0.72 0.18 286)",
      sidebarPrimaryForeground: "oklch(0.98 0 0)",
      sidebarAccent: "color-mix(in srgb, var(--primary) 8%, var(--background) 92%)",
      sidebarAccentForeground: "color-mix(in srgb, var(--foreground) 90%, white 10%)",
      sidebarSelected: "color-mix(in srgb, var(--muted) 78%, var(--background) 22%)",
      sidebarSelectedForeground: "var(--foreground)",
      sidebarIcon: "color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)",
      sidebarBorder: "color-mix(in srgb, var(--border) 90%, white 10%)",
      sidebarRing: "oklch(0.72 0.18 286)",
    },
  },
  dark: {
    background: "oklch(0.145 0.008 286)",
    foreground: "oklch(0.95 0.01 286)",
    card: "oklch(0.19 0.012 286)",
    cardForeground: "oklch(0.95 0.01 286)",
    popover: "oklch(0.19 0.012 286)",
    popoverForeground: "oklch(0.95 0.01 286)",
    primary: "oklch(0.72 0.18 286)",
    primaryForeground: "oklch(0.98 0 0)",
    secondary: "oklch(0.24 0.02 286)",
    secondaryForeground: "oklch(0.92 0.01 286)",
    muted: "oklch(0.22 0.015 286)",
    mutedForeground: "oklch(0.65 0.02 286)",
    accent: "oklch(0.26 0.025 286)",
    accentForeground: "oklch(0.92 0.01 286)",
    destructive: "oklch(0.704 0.191 22.216)",
    destructiveForeground: "oklch(0.985 0 0)",
    border: "oklch(1 0.01 286 / 12%)",
    input: "oklch(1 0.01 286 / 15%)",
    ring: "oklch(0.72 0.18 286)",
  },
  typography: {
    bodyFont: '"Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    headingFont:
      '"Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    monoFont: '"SFMono-Regular", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
  },
  radius: {
    radius: "0.875rem",
  },
  branding: {
    appName: "Foundry UI",
    appTitle: "Foundry UI",
  },
};

export function getThemePreset(name?: string | null): ThemeDefinition {
  if (!name || name === "foundry-violet") return FOUNDRY_VIOLET_THEME;
  return FOUNDRY_VIOLET_THEME;
}

function deriveSurfaceColors(
  resolved: ThemeColorSlots,
  explicit: ThemeColorSlots | undefined,
): { colors: ThemeColorSlots; changed: Set<keyof ThemeColorSlots> } {
  // The preset remains the safe fallback for an entirely unthemed product.
  // Only values depending on an authored colour should move. A sparse edit
  // to an unrelated slot must not repaint preset surfaces.
  const changed = new Set<keyof ThemeColorSlots>(
    (Object.keys(explicit ?? {}) as (keyof ThemeColorSlots)[]).filter((key) =>
      Boolean(explicit?.[key]),
    ),
  );
  if (!explicit || changed.size === 0) return { colors: resolved, changed };
  const next = { ...resolved, ...explicit };
  const setDerived = (
    key: keyof ThemeColorSlots,
    value: string | undefined,
    sources: (keyof ThemeColorSlots)[],
  ) => {
    if (!explicit[key] && value && sources.some((source) => changed.has(source))) {
      next[key] = value;
      changed.add(key);
    }
  };
  setDerived("heading", next.foreground, ["foreground"]);
  setDerived("contentHeading1", next.heading, ["heading"]);
  setDerived("contentHeading2", `color-mix(in srgb, ${next.heading} 78%, ${next.foreground} 22%)`, [
    "heading",
    "foreground",
  ]);
  setDerived("contentHeading3", next.foreground, ["foreground"]);
  setDerived("contentHeading4", next.foreground, ["foreground"]);
  setDerived("contentHeading5", next.foreground, ["foreground"]);
  setDerived("contentHeading6", next.foreground, ["foreground"]);
  setDerived("card", next.background, ["background"]);
  setDerived("cardForeground", next.foreground, ["foreground"]);
  setDerived("popover", next.card, ["card"]);
  setDerived("popoverForeground", next.foreground, ["foreground"]);
  setDerived("secondary", `color-mix(in srgb, ${next.background} 94%, ${next.primary} 6%)`, [
    "background",
    "primary",
  ]);
  setDerived("secondaryForeground", next.foreground, ["foreground"]);
  setDerived("muted", `color-mix(in srgb, ${next.background} 97%, ${next.foreground} 3%)`, [
    "background",
    "foreground",
  ]);
  setDerived(
    "mutedForeground",
    `color-mix(in srgb, ${next.foreground} 62%, ${next.background} 38%)`,
    ["foreground", "background"],
  );
  setDerived("accent", `color-mix(in srgb, ${next.background} 90%, ${next.primary} 10%)`, [
    "background",
    "primary",
  ]);
  setDerived("accentForeground", next.foreground, ["foreground"]);
  setDerived("border", `color-mix(in srgb, ${next.foreground} 14%, ${next.background} 86%)`, [
    "foreground",
    "background",
  ]);
  setDerived("input", next.border, ["border"]);
  setDerived("ring", next.primary, ["primary"]);
  return { colors: next, changed };
}

export function resolveThemeRuntime(layers: ThemeLayer[], mode: ThemeMode): ResolvedThemeRuntime {
  const effectiveMode = getEffectiveThemeMode(mode);
  const basePreset =
    layers.find((layer) => layer.basePreset && layer.basePreset.trim())?.basePreset ??
    "foundry-violet";
  const customDefinition = mergeThemeDefinitions(...layers.map((layer) => layer.definition));
  const definitions = [getThemePreset(basePreset), customDefinition];
  const definition = mergeThemeDefinitions(...definitions);
  const { colors, changed } = deriveSurfaceColors(
    { ...(effectiveMode === "dark" ? definition.dark : definition.light) },
    effectiveMode === "dark" ? customDefinition.dark : customDefinition.light,
  );
  const explicitSidebar =
    effectiveMode === "dark" ? customDefinition.sidebar?.dark : customDefinition.sidebar?.light;
  const presetSidebar =
    effectiveMode === "dark"
      ? getThemePreset(basePreset).sidebar?.dark
      : getThemePreset(basePreset).sidebar?.light;
  const sidebarSources: Record<keyof ThemeSidebarSlots, keyof ThemeColorSlots | null> = {
    sidebar: "secondary",
    sidebarForeground: "foreground",
    sidebarPrimary: "primary",
    sidebarPrimaryForeground: "primaryForeground",
    sidebarAccent: "accent",
    sidebarAccentForeground: "accentForeground",
    sidebarSelected: "muted",
    sidebarSelectedForeground: "foreground",
    sidebarIcon: null,
    sidebarBorder: "border",
    sidebarRing: "ring",
  };
  const derivedSidebar = defaultSidebar(colors);
  const sidebar = {
    ...derivedSidebar,
    ...presetSidebar,
    ...Object.fromEntries(
      (Object.keys(sidebarSources) as (keyof ThemeSidebarSlots)[])
        .filter((key) => sidebarSources[key] && changed.has(sidebarSources[key]!))
        .map((key) => [key, derivedSidebar[key]]),
    ),
    ...explicitSidebar,
  } as ThemeSidebarSlots;
  const status = {
    ...defaultStatus(effectiveMode, colors),
    ...(effectiveMode === "dark" ? customDefinition.status?.dark : customDefinition.status?.light),
  } as ThemeStatusSlots;
  const charts = {
    ...defaultCharts(effectiveMode),
    ...(effectiveMode === "dark" ? customDefinition.charts?.dark : customDefinition.charts?.light),
  } as ThemeChartSlots;
  const typography = {
    ...FOUNDRY_VIOLET_THEME.typography,
    ...customDefinition.typography,
  } as ThemeTypographySlots;
  const radius = {
    ...FOUNDRY_VIOLET_THEME.radius,
    ...customDefinition.radius,
  } as ThemeRadiusSlots;
  const app = {
    ...defaultApp(effectiveMode, colors),
    ...(effectiveMode === "dark" ? customDefinition.app?.dark : customDefinition.app?.light),
  } as ThemeAppSlots;
  const branding = {
    ...FOUNDRY_VIOLET_THEME.branding,
    ...customDefinition.branding,
  } as ThemeBranding;

  return {
    mode: effectiveMode,
    definition,
    branding,
    variables: toCssVars(colors, sidebar, status, charts, typography, radius, app),
    sources: layers,
  };
}
