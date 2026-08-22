---
"@iloveagents/foundry-web-ui": minor
---

`DataTableToolbar` stays calm with many facets: only pinned facets (explicit `pinned`, else the first `pinnedFacets`, default 3) are always visible; the rest wait behind a "+ Filter" menu and appear once chosen or active. Selected values on a facet button are short, truncated badges (a count beyond two). `visibleFacets()` exposes the split.
