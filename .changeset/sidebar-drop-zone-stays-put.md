---
"@iloveagents/foundry-web-ui": patch
---

The sidebar's container drop zone no longer moves the rows beneath it.

The 4px strip inside an expanded container grew to a 28px labelled band in
flow while a drag was over it, so every row below jumped down 24px at the
moment the pointer crossed it — which is the moment the user is aiming at
one of those rows. Dragging an item from an open folder down to another
folder crosses one strip per open container, so the destination walked away
from the cursor and the drop landed on whatever had slid underneath. The
gesture then appeared to do nothing at all.

The band is now absolutely positioned over the strip and grows about its own
centre, so the layout is stable for the whole drag.
