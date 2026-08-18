---
"@iloveagents/foundry-web-ui": patch
---

Stop hoisting the model's prose to the bottom of an assistant message.

Text carried a flex `order-2` so every prose part floated below the
machinery — added when the only machinery was a reasoning row, to keep it
from sitting above a one-line answer.

Multi-step agent turns emit prose BETWEEN steps, and the hoist stripped it
out from between the work and stacked the bare summary rows into a column:
the exact ladder the activity row removes. It also glued consecutive prose
parts into one run-on paragraph.

Nothing reorders now. Parts render where the model put them, so a multi-step
turn reads as work, what it learned, work, what it learned, answer. The
`placement`/`after-tools` option on `MessageDisclosure` is removed with it.
