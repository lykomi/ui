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

So the space is reserved for the whole drag rather than on hover. The zone
stays in flow, and the band fills exactly the strip it reserved, so what is
painted is what accepts.

"For the whole drag" has to mean it, so the reservation opens instantly and
only the collapse animates — an animated opening is a moving target for as
long as it runs, and 150ms is inside the time a short drag to a nearby row
takes.

It also has to mean "before the user has aimed", which is as much a
precondition as it is the point. Only a drag that starts in this document has
a moment before the aim: `dragstart` fires before any movement, so the layout
settles while the pointer is still on the row being picked up. A drag arriving
from outside — the desktop, or another window — has no such moment; the
browser hit-tests whatever is under the pointer before any script runs, so the
first `dragenter` the document sees is already aimed at something. Opening the
zones from it would move that something out from under a stationary pointer —
the very failure this change exists to remove, arriving by a different road.
So outside drags get no reservation: the strips stay 4px and nothing moves.
They are not left without a target, because container rows accept and
highlight file drops themselves.

Because the zone is open before the pointer reaches it, nothing about the drag
can be read off the zone's own hover state any more, so the drag publishes the
set of MIME types it carries, and whether a zone opens at all follows that:
reserving space and painting a label is a promise that a drop will land, so a
container that takes entity moves but not files stays shut for a file drag,
and a module's zones no longer open for another module's `dnd.type`.

A set rather than one type, because `dragstart` bubbles and a draggable row
sits inside a draggable container — both handlers run, and tracking one would
track whichever ran last, leaving zones that match the child's payload shut.

The set is read directly and never serialised: a MIME token may legally
contain any separator one might join them with (`|` is not one of RFC 2045's
tspecials), and a split on it turns one type into two — the zone that owns
it staying shut while a zone matching a fragment opens for data it cannot
read. What components subscribe to is a version counter instead.

A drag also ends when a nav refresh removes the row it started from. Such a
source still receives its own `dragend`, but a detached node's event reaches
no window listener — so the reservation would otherwise stay open, every zone
expanded, until some later drag happened to finish elsewhere.
