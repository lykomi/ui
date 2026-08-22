---
"@iloveagents/foundry-web-ui": minor
---

Add the DataTable family: `useDataTable` + `DataTable`, `DataTableToolbar` with faceted filters that carry live counts (OR within a facet, AND across facets, array-aware, "None" for empty cells), AND-of-tokens search, `DataTableColumnHeader` (sort / hide), `DataTableViewOptions` (column visibility), `DataTablePagination`, `DataTableRowActions`, `selectionColumn`, single-level grouping with declared group order, and a URL codec (`serializeDataTableState` / `parseDataTableState` / `mergeDataTableUrlState`) that keeps the existing `q` / `sort` / `f_<id>` keys. Also adds `DropdownMenuCheckboxItem`. Built on `@tanstack/react-table` 8.
