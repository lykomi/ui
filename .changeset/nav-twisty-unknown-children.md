---
"@iloveagents/foundry-web-ui": minor
---

A nav row no longer claims to be a leaf when its children were never fetched.

A tree row shows a chevron if it branches and a dot if it is a leaf — two
markers for a question with three answers, the third being "nobody has
looked". A nav that loads subtrees lazily leaves every unvisited row with an
empty `children`, and the row then asserted "nothing under this one" on the
strength of a request that was never sent. Selecting it turned the dot into a
chevron.

`NavItem` gains `childrenUnloaded`. While it is set, the row shows neither
marker — no dot asserting an emptiness nobody checked, no chevron opening onto
nothing — and the cell still holds its column so labels stay aligned and no
marker jumps sideways when the answer arrives. Loaded children still win: the
flag describes ignorance, not a display mode.
