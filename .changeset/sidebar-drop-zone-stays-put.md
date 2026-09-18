---
"@iloveagents/foundry-web-ui": patch
---

The sidebar's container drop zone no longer moves the rows beneath it, nor
answers for the rows beside it.

The 4px strip inside an expanded container grew to a 28px labelled band when a
drag arrived over it, and growing on hover is wrong in both available shapes.
In flow, every row below jumped 24px at the moment the pointer crossed the
strip — which is the moment the user is aiming at one of those rows, so the
destination walked away from the cursor and the drop landed on whatever had
slid underneath. Out of flow, nothing moves, but the expanded band covers
about 12px of the rows on either side and takes their drops instead.

So the space is reserved for the whole drag rather than on hover: it opens on
`dragstart` — before the user has aimed at anything — and closes when the drag
ends. The zone stays in flow, and the band fills exactly the strip it reserved,
so what is painted is what accepts.

A drag from the desktop has no `dragstart` in the document, so the first nav
element to see `Files` on a `dragenter` opens the same reservation.
