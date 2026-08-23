---
"@iloveagents/foundry-web-primitives": patch
---

Checkbox: "some of these" now looks like its own state

An indeterminate checkbox was left unstyled — a tick drawn on a white
box, which is the one shape that reads as *not* selected. Every list's
select-all header inherited that: tick a single row and the header
claimed a selection nobody made.

Indeterminate now fills like checked and draws a minus instead of a
check, so partial, none and all are three distinguishable shapes.
