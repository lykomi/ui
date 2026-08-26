---
"@iloveagents/foundry-web-ui": patch
---

Categorical charts tell the truth about which category is which.

An adversarial review of the freshly-shipped chart family found the fold
and the palette disagreeing with the discipline the family documents.

- **The fold ranks before it folds.** `foldCategoryTail` kept the head of
  whatever order it was handed, and `DonutChart` handed it the raw data.
  Six small categories followed by a dominant one rendered as four slivers
  and an unlabeled 96% "Other" — the largest slice invisible. Ranking
  happens inside the fold now, so no caller can reintroduce it, including
  the agent-written renderers this library exists to serve.
- **The palette has one rule now.** A DECLARED category owns its declared
  slot — reserved whether or not it is currently drawn, which is what keeps
  its color stable when a filter removes its neighbours — and undeclared
  drawn categories fill the slots no declaration claimed. Past the palette,
  or with every slot spoken for, a category takes the muted fold color
  rather than wrapping onto a color someone else owns. Declare the
  categories whose colors must not move; the rest sort themselves out.
- **Distinct categories no longer share a color.** Identity resolution mixed
  two index spaces (declared config keys vs. row position), so two
  categories could both take slot 1; past five it wrapped modulo the palette
  onto colors other categories already owned. One resolver
  (`categoryColorResolver`) now orders declared keys first and undeclared
  categories after, and anything past the palette takes the muted fold color
  rather than a duplicate. A bar chart's measure entry is excluded from that
  order — it labels the value column and is not a category.
- **`--chart-color-<key>`, not `--color-<key>`.** The old name shares a
  namespace with Tailwind's own color tokens, so a series called `white` or
  `primary` could repaint utilities inside the chart.
- **An undeclared series stays visible.** `seriesVar` takes a fallback, so a
  key with no config renders its palette slot instead of falling through an
  undefined custom property to black.
- Duplicate category values render without React key collisions; `Infinity`
  and `NaN` no longer reach the screen as `▲ ∞%` styled _good_, `NaN%`, or a
  `"NaN"` stat value; `maxBars={NaN}` no longer collapses a chart into one
  bucket; `ChartCard`'s tooltip loses its empty header row.

Tests grew with the fixes, and closed gaps the review demonstrated: the
whole `formatBucketLabel` formatter was passing assertions that the identity
function also passed, the responsive render path (the one every real
consumer uses) was never mounted, no test asserted a series color reaches a
mark, and `chart-card.tsx` had no tests at all.
