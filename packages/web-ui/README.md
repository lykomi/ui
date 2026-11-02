# @iloveagents/foundry-web-ui

React UI core for Foundry UI apps.

`web-ui` is the package that renders the actual agent experience: chat UI,
composer, AG-UI adapter, message rendering, tool-call cards, side panels,
sidebar, theme runtime, context pins, attachment handling, and UI stores. It
depends on `@iloveagents/foundry-web-primitives` for leaf primitives (Button,
Input, Field, Checkbox, Textarea, `cn`).

## Install

```bash
pnpm add @iloveagents/foundry-web-ui @iloveagents/foundry-web-primitives
```

## Usage

```tsx
import {
  AGUIRuntimeProvider,
  Sidebar,
  ChatContent,
  ToolPanel,
  useAppStore,
  usePageTools,
} from "@iloveagents/foundry-web-ui";
import { cn } from "@iloveagents/foundry-web-primitives";
```

This package publishes built ESM JavaScript and `.d.ts` declarations. Host apps
must include Tailwind v4 `@source` directives so classes used inside package
components are generated:

```css
@import "@iloveagents/foundry-web-ui/styles.css";
@source "../node_modules/@iloveagents/foundry-web-primitives/dist";
@source "../node_modules/@iloveagents/foundry-web-ui/dist";
```

## Process guidance

`ProcessSteps` provides a connected status rail. `ProcessGuide` adds focused
guidance, content and actions for controlled wizards or resumable processes.
See the [process guidance contract and examples](https://github.com/lykomi/ui/blob/main/docs/PROCESS_GUIDE.md).

## Lists

Every list renders through one `DataTable` family (TanStack Table underneath):
AND-of-tokens search, faceted filters with live counts (OR within a facet, AND
across facets, array cells count per element, empty cells as "None"), sortable
headers, column visibility, row selection, optional paging, optional grouping,
and a URL codec that keeps `q` / `sort` / `f_<column>` / `hide` / `page` / `size`.

```tsx
const table = useDataTable({ data: rows, columns, getRowId: (row) => row.id, pageSize: 20 });

<DataTableToolbar table={table} facets={[{ columnId: "status" }, { columnId: "priority" }]} />
<DataTable table={table} onRowClick={(row) => open(row.original)} />
<DataTablePagination table={table} />
```

Give a column `filterFn: facetFilterFn` (or the string `"facet"` in untyped
code) to use it as a facet; `meta.facetLabels` names
its values, `meta.label` names the column in the View menu, and
`DataTableColumnHeader` makes a header sortable. Pass `state` + `onStateChange`
(with `parseDataTableState` / `mergeDataTableUrlState`) to keep the whole list
state in the URL.

### A column says where it earns its place

```tsx
const column: ColumnDef<Risk> = {
  id: "worst_case",
  accessorKey: "worst_case",
  meta: {
    breakpoint: "lg", // the narrowest LIST width it needs (not the window)
    showIn: "focus", // only when the list has the screen to itself
    pinned: "left", // frozen against the left edge while the rest scrolls
    defaultHidden: true, // in the Columns menu, off until asked for*
    align: "right",
  },
};
```

Widths are measured on the table itself, so a list beside an open detail pane
sheds exactly the columns a narrow window would and focus mode brings them
back — no media queries in the host. `DATA_TABLE_MIN_WIDTH` publishes the
bands (`sm` 448 · `md` 672 · `lg` 896 · `xl` 1024 · `2xl` 1280) for a host that
derives them from a schema.

\* `useDataTable` applies `defaultHidden` to its own initial state. A list
whose state lives elsewhere (the URL) passes `defaultHiddenColumns(columns)`
into that layer's `defaults` instead — a hidden-only URL records nothing when
a column is _shown_, so re-applying the default on every render would undo the
user the moment they bring one out.

Freezing is a run from the left edge: every column up to the last `pinned` one
comes along, so a leading checkbox never slides out from under its rows.

That gating is render-time and deliberately **not** TanStack `columnVisibility`
(which belongs to the user and rides in the URL), so anything that must agree
with what is on screen reads `onRenderedColumnsChange` rather than
`column.getIsVisible()`.

### Numbers and dates you can tick

`meta.facetBuckets` turns a raw value into the keys a person actually filters
by; counts, OR-within, AND-across, the URL and the agent tools work on those
keys unchanged.

```tsx
const probability: ColumnDef<Risk> = {
  id: "probability",
  accessorKey: "probability",
  filterFn: facetFilterFn,
  meta: {
    facetBuckets: (value) => [Number(value) >= 0.5 ? "high" : "low"],
    facetLabels: { high: "50 % or more", low: "under 50 %" },
  },
};
```

Dates get the buckets every list wants: `ageBucket` (`today` · `week` ·
`month` · `older` · `never`), `dueState` (`overdue` · `soon` · `later` ·
`undated`) and `relativeAge` for the cell. `parseDateish` underneath reads ISO
and the dotted European form and refuses `03/04/2026` — March in one country,
April in another — rather than guessing.

### Selecting, opening, and the keyboard

A click selects (`onRowClick`), Enter or a double click opens (`onRowOpen`) —
the desktop-list split, so brushing a row never opens a pane by surprise.
`selectionColumn()` adds the tick boxes; `DataTableSelectionBar` is the one
place bulk actions live (and the selection a chat agent reads).
`onActiveRowChange` + `activeRowId` walk the list with ↑/↓/Home/End, Escape
clears, and the active row stays scrolled into view.

`useAppStore.setContextItem(key, item | null)` keeps one context chip per key,
so a list can keep the chat in step with its selection instead of piling up
stale chips.

### Room to scroll

`DataTable` takes `maxHeight` to give a list its own viewport (sticky header,
both axes) instead of running down the page; inside a focused `DataTableFrame`
it fills the layer. `spacer` (default) keeps columns at their natural width
with the slack at the end, the way a spreadsheet looks.

## Charts and management dashboards

Import charts from `@iloveagents/foundry-web-ui/chart`; this optional subpath
keeps Recharts out of hosts that do not draw charts. Use `DashboardGrid` and
`DashboardTile` for layout, `ChartCard` for consistent frames, and `StatCard`
for headline metrics. `TimeSeriesChart`, `CategoryBarChart` and `DonutChart`
share theme colors, legends and tooltips.

```tsx
import { GaugeChart, Sparkline, StatCard } from "@iloveagents/foundry-web-ui/chart";

<GaugeChart
  label="On-time delivery"
  value={92.4}
  target={90}
  tone="success"
  valueFormatter={(value) => `${value}%`}
/>;
<StatCard
  label="Revenue"
  value="$3.04M"
  delta={18.6}
  deltaLabel="vs previous year"
  trend={
    <Sparkline data={[181, 195, 190, 214, 232, 248]} label="Monthly revenue, January to June" />
  }
/>;
```

`GaugeChart` defaults to 0–100, supports custom ranges, and clamps the arc
while displaying the actual value when it exceeds the range. Its accessible
meter carries that actual value as text. Missing/non-finite values and invalid
ranges show “No data”; `loading` shows “Loading…”. Targets outside the range
are omitted. The arc stays clean by default; set `showTargetMarker` to add a
target tick while the target text is always shown. Choose `tone` and `hint` explicitly for metric semantics, including
lower-is-better metrics. Sparklines leave gaps for missing samples and need a
metric/period label; use a full chart when exact values matter.

An ordered `segments` breakdown colors adjacent portions of the same arc:

```tsx
<GaugeChart
  label="Confirmed quality"
  value={29}
  valueFormatter={(value) => `${value}%`}
  segments={[
    { label: "Confirmed", value: 29, color: "var(--chart-1)" },
    { label: "Assessed gaps", value: 7.2, color: "var(--warning)" },
    { label: "Not evidenced", value: 63.8, color: "var(--muted)" },
  ]}
/>
```

Segment values use the gauge's units and must total `max - min`. The central
reading remains `value`; a secondary share never disappears into the track.
Hover or focus a segment for its label, value and optional `description`.
Invalid or incomplete breakdowns show “Invalid breakdown”; they are never
normalized. Zero-length segments are omitted without inflating small values.

See [the management dashboard example](../../examples/management-dashboard/README.md)
for a complete composition with period selection and light/dark preview.

## Navigation backgrounds

Themes may set `sidebar.light.sidebarBackgroundImage` and
`sidebar.dark.sidebarBackgroundImage` to a CSS `background-image`, including
layered gradients. The workbench draws one continuous background behind desktop
navigation and pane gaps; content panes retain their solid surfaces. Standalone
and mobile navigation draw the same image on their own surface. Use `none` to
clear an inherited image. Keep `sidebar` as the solid fallback color so color
mixes, selection and borders continue to work. Existing themes default to `none`.

## Extension Points

Feature modules (like SPACES) plug into `@iloveagents/foundry-web-ui` via registries — no direct imports needed:

- **NavItem.dnd** — drag-and-drop behavior on sidebar items
- **UserMenuAction** — ordinary actions in the account menu across shell layouts
- **Panel renderer registry** — custom content renderers for the side panel
- **Citation handler** — handles `[n]` citation clicks in markdown
- **Tool UI** — custom rendering for agent tools via `makeAssistantToolUI`

See [AGENTS.md](https://github.com/lykomi/ui/blob/main/packages/web-ui/AGENTS.md) for architecture details and import boundary rules.

Register a menu action when a feature mounts and remove it on cleanup:

```tsx
useEffect(() => {
  useNavStore.getState().setUserMenuAction({
    id: "account-settings",
    label: "Account settings",
    onSelect: () => navigate("/settings"),
  });
  return () => useNavStore.getState().removeUserMenuAction("account-settings");
}, [navigate]);
```

Registering the same ID replaces its label and handler without duplicating the
item. Use `setUserMenuToggle` for preferences with a checked state. Feature
modules own routing and authorization; the menu invokes their action.

### Lazy navigation branches

A module may publish a container with `childrenUnloaded: true` and
`onExpandedChange`. The sidebar offers a disclosure button and notifies the
owner when it opens, including an active route opened automatically. The owner
fetches authorized children and republishes its navigation config. Deduplicate
requests across sidebar surfaces and reject responses from an obsolete user,
workspace, snapshot or mutation generation.

Set `childrenLoading` during a read and `childrenError` to safe user-facing text
on failure. Existing children stay visible. Retry calls `onExpandedChange(true)`;
it never navigates or changes permissions. After the last page, publish
`childrenUnloaded: false` even for an empty folder. Native pagination uses
`childrenHasMore` and `onLoadMoreChildren`; the owner retains its source cursor.

Branch expansion is document-local. Persistent collapsed group preferences
remain separate; opening a fresh browser tab does not restore unrelated trees.
