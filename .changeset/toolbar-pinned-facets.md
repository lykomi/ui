---
"@iloveagents/foundry-web-ui": minor
---

Lists stay calm and fit the screen: `DataTableToolbar` pins only the first facets (explicit `pinned`, else `pinnedFacets`, default 3) and parks the rest behind a "+ Filter" menu until chosen or active, with short truncated selection badges; a column's `meta.breakpoint` ("sm" | "md" | "lg" | "xl" | "2xl") hides it below that viewport; `DataTableFrame` adds a focus (fullscreen) mode with a toolbar button and Escape to leave. `visibleFacets()` exposes the facet split.
