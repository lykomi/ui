---
"@iloveagents/foundry-web-ui": minor
---

feat(sidebar): Confluence-style branch/leaf chevrons in the nav tree

Every nav row now leads with a fixed-width disclosure cell: a chevron when the
item has children, a small dot when it is a leaf. The chevron is visible at
rest and rotates on expand, so the shape of the tree — which rows go deeper,
which are terminal, which are open — is readable without hovering a single row.

Previously expand/collapse lived in the hover-only right-hand row controls,
which meant a nav at rest carried no branch/leaf information at all. That slot
now holds the item's actions menu only.

- Row indent moved from the inner navigate button to the row wrapper, one
  8px rung per depth, so the disclosure cells stack in one column that also
  lines up with the collapsible group-header chevron.
- Rows expose `data-nav-depth`, and branch chevrons expose `data-nav-twisty`
  plus `aria-expanded`, giving tests and downstream E2E a stable handle on the
  tree structure.
- Clicking a chevron toggles without navigating; clicking the row still
  navigates and expands as before.
- The chevron draws in a 16px cell but takes clicks in 24px (WCAG 2.2 target
  size), and rows expose `data-sidebar-surface` so a test or E2E selector can
  address the desktop rail and the mobile drawer separately.
- The disclosure cell is absolutely positioned over the row's own padding, so
  the entire row — indent strip and cell included — stays a live navigation
  target while the branch chevron still catches its own clicks.
