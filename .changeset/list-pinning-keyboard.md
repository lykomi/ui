---
"@iloveagents/foundry-web-ui": minor
---

Wide lists keep their bearings. `meta.pinned: "left"` freezes leading columns against the left edge (offsets measured from the rendered header cells, an edge border on the last pinned one). `onActiveRowChange` walks the active row with ↑/↓/Home/End, clears it with Escape and keeps it scrolled into view — the master-list keyboard flow beside a detail pane. And `meta.breakpoint` is now measured against the _list's_ own width (the table root is a `@container`): a list narrowed by an open detail pane sheds the same columns a narrow window would, and focus mode brings them back.
