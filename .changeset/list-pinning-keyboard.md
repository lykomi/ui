---
"@iloveagents/foundry-web-ui": minor
---

Wide lists keep their bearings. `meta.pinned: "left"` freezes leading columns against the left edge (offsets measured from the rendered header cells, an edge border on the last pinned one). `onActiveRowChange` walks the active row with ↑/↓/Home/End, clears it with Escape and keeps it scrolled into view — the master-list keyboard flow beside a detail pane. And `meta.breakpoint` is measured against the *list's own width* rather than the window, so a list narrowed by an open detail pane sheds exactly the columns a narrow window would and focus mode brings them back — no CSS wiring in the host. Two facet options clicked in quick succession now both stick (the toggle is a functional update, so it no longer reads a value the pending render has not applied).
