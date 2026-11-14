/**
 * Design tokens → concrete colours for the canvas.
 *
 * `react-force-graph-2d` paints to a `<canvas>`, and a canvas cannot read CSS
 * custom properties: `ctx.fillStyle = "var(--foreground)"` silently paints
 * black. So every colour the renderer uses has to be resolved from the DOM
 * first, and re-resolved when the theme flips — otherwise a light-mode graph
 * stays light-on-light after the user switches to dark.
 *
 * Tokens come from the host's stylesheet (`@lykomi/web-ui/styles.css`
 * plus this package's `styles.css`), so a themed app gets a themed graph for
 * free.
 */

/** Tokens this package resolves. Values are whatever the host's CSS says. */
export interface GraphTheme {
  foreground: string;
  mutedForeground: string;
  background: string;
  border: string;
  ring: string;
  /** Categorical node palette, in assignment order. */
  palette: string[];
}

/**
 * Preferred palette: this package's own tokens (`styles.css`), which give
 * eight well-separated hues.
 */
const PALETTE_TOKENS = [
  "--graph-1",
  "--graph-2",
  "--graph-3",
  "--graph-4",
  "--graph-5",
  "--graph-6",
  "--graph-7",
  "--graph-8",
] as const;

/**
 * Second choice: the chart tokens every LYKOMI UI app already has from
 * `@lykomi/web-ui/styles.css`. Five hues instead of eight, but a
 * themed app that forgot to import this package's stylesheet still gets colours
 * that match its brand rather than the generic fallback below.
 */
const CHART_PALETTE_TOKENS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

/**
 * Last-resort palette, used when this package's `styles.css` was not imported.
 * Plain hex on purpose: it must not itself depend on a token resolving.
 */
export const FALLBACK_THEME: GraphTheme = {
  foreground: "#18181b",
  mutedForeground: "#71717a",
  background: "#ffffff",
  border: "#e4e4e7",
  ring: "#8b5cf6",
  palette: ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#16a34a", "#2563eb", "#ca8a04", "#9333ea"],
};

function readToken(styles: CSSStyleDeclaration, name: string): string | null {
  const raw = styles.getPropertyValue(name).trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Resolve the theme against a mounted element.
 *
 * Takes an element rather than `document.documentElement` so a graph inside a
 * scoped theme (the shell's `ThemeScope`, a preview pane) picks up that scope's
 * tokens instead of the page's.
 */
export function resolveGraphTheme(element: Element | null): GraphTheme {
  if (!element || typeof window === "undefined" || !window.getComputedStyle) {
    return FALLBACK_THEME;
  }
  const styles = window.getComputedStyle(element);
  const readAll = (tokens: readonly string[]) =>
    tokens
      .map((token) => readToken(styles, token))
      .filter((value): value is string => value !== null);

  const graphPalette = readAll(PALETTE_TOKENS);
  const chartPalette = graphPalette.length > 0 ? [] : readAll(CHART_PALETTE_TOKENS);
  const palette = graphPalette.length > 0 ? graphPalette : chartPalette;
  return {
    foreground: readToken(styles, "--foreground") ?? FALLBACK_THEME.foreground,
    mutedForeground: readToken(styles, "--muted-foreground") ?? FALLBACK_THEME.mutedForeground,
    background: readToken(styles, "--background") ?? FALLBACK_THEME.background,
    border: readToken(styles, "--border") ?? FALLBACK_THEME.border,
    ring: readToken(styles, "--ring") ?? FALLBACK_THEME.ring,
    palette: palette.length > 0 ? palette : FALLBACK_THEME.palette,
  };
}
