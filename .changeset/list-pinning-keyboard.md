---
"@iloveagents/foundry-web-ui": minor
---

Wide lists keep their bearings. `meta.pinned: "left"` freezes leading columns against the left edge (offsets measured from the rendered header cells, an edge border on the last pinned one). `onActiveRowChange` walks the active row with ↑/↓/Home/End, clears it with Escape and keeps it scrolled into view — the master-list keyboard flow beside a detail pane. And `meta.breakpoint` is measured against the _list's own width_ rather than the window, so a list narrowed by an open detail pane sheds exactly the columns a narrow window would and focus mode brings them back — no CSS wiring in the host. Two facet options clicked in quick succession now both stick (the toggle is a functional update, so it no longer reads a value the pending render has not applied). `DataTable` also takes `maxHeight`, giving a list its own scroll viewport (sticky header, both axes) instead of running down the page, and `DataTableFrame` forwards a ref so a host can measure it.

Rules the components need but a host's CSS scanner cannot infer — frozen-column stickiness and its opaque row tints, and a long menu capped to the room it has and scrollable inside — now ship in this package's `styles.css`, so importing that stylesheet (as the README says) is all a host has to do.

The grid itself reads like a spreadsheet: columns keep their natural width with the slack at the end (`spacer`), a group header's label and total stay put while the columns scroll, the frozen edge carries a seam, and the Columns menu shows each column's own label rather than title-casing it.

Selecting and opening are separate acts, the way a desktop list behaves: a click selects (`onRowClick`), Enter or a double click opens (`onRowOpen`), and the tick boxes of `selectionColumn` are the selection a chat agent reads. `DataTableSelectionBar` gives every list one place for bulk actions on that selection. The frozen seam only appears once the list is scrolled sideways, and list scrollbars stay visible instead of relying on the overlay ones macOS hides.

Context that tracks the UI now has a home: `useAppStore.setContextItem(key, item | null)` keeps one item per key, so a list can keep the chat in step with its selection — replacing the chip as the selection changes and taking it away when it empties — without piling up stale ones next to the user's own pins.

A column says where it earns its place: `meta.breakpoint` is the narrowest list width it needs, and `meta.showIn: "focus"` keeps it for when the list has the screen to itself — so an embedded list stays scannable and going fullscreen genuinely shows more. Focus mode also shows every facet, and `DataTableFrame` reports focus changes to its host.
