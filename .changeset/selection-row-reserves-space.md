---
"@iloveagents/foundry-web-ui": patch
---

`DataTableToolbar`: a selection bar now takes toolbar space in the
non-stacked layout too, instead of adding a row. A list with no facets grew
by one row the moment the first row was ticked, shoving the table down under
the cursor mid-click — the jump the stacked layout already avoided by
swapping its filter row for the selection bar. Search stays put in both
layouts; only the filter controls give way.
