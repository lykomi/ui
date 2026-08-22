---
"@iloveagents/foundry-web-ui": minor
---

`DataTableToolbar` reads as two bands instead of one ragged wrap: row 1 is search plus a fixed right group (Filters toggle · actions · View · focus), row 2 is the filter row (facets · + Filter · Reset). The filter row collapses behind the "Filters" toggle — which keeps the active count visible — for dense, spreadsheet-like screens. `layout="inline"` restores the single wrapping row.
