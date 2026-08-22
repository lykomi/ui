---
"@iloveagents/foundry-web-ui": patch
---

Frozen columns stay under the sticky header while a list scrolls (the cell's `z-index` outranked the header row's, so the header was painted over), and they restate the row's focus tint like its other states.

What the table actually draws is now one list, derived once: the frozen run never includes a column the width gate dropped (no seam on an invisible column), a grouping header narrows to the leaves that survive and disappears when none do, and `onRenderedColumnsChange` tells the host which columns are on screen — render-time gating is not TanStack visibility, so anything that must agree with the user's view (a chat agent reading the list) has something truthful to read.

The active row also scrolls into view when it _moves_ — a late-arriving page or a re-sort — not only when its id changes, and the facet filter resolves a column once per row instead of scanning every cell on every pass.
