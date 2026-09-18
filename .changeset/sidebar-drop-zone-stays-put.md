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

"For the whole drag" has to mean it, so:

- the reservation opens instantly and only the collapse animates — an
  animated opening is a moving target for as long as it runs, and 150ms is
  inside the time a short drag to a nearby row takes;
- a drag from the desktop has no `dragstart` in the document, so a
  window-level watcher opens the reservation on the first `dragenter`
  anywhere — as the pointer crosses the window edge, not when it has already
  arrived over the row it was aimed at;
- a drag dragged out of the window and back keeps its reservation. That exit
  looks the same for both kinds of drag, and it ends only the kind that
  cannot report its own end; an in-page drag has a `dragend`, and collapsing
  on the exit made the root it was aimed at vanish for the rest of the
  gesture.

Because the zone is open before the pointer reaches it, nothing about the drag
can be read off the zone's own hover state any more, so the drag publishes the
set of MIME types it carries. The label follows that (a file drag reads "Upload
to root" on approach instead of promising a move), and so does whether a zone
opens at all: reserving space and painting a label is a promise that a drop
will land, so a container that takes entity moves but not files stays shut for
a file drag, and a module's zones no longer open for another module's
`dnd.type`.

A set rather than one type, because one type is wrong in two ways. `dragstart`
bubbles, and a draggable row sits inside a draggable container, so both
handlers run and both write to `dataTransfer` — publishing one would publish
whichever ran last and leave zones matching the child's payload shut. And a
drag entering from another window of the same app carries its own custom
types, which are adopted exactly as `Files` is, so the root target no longer
stays an unlabelled strip for a gesture its own `onDrop` would have accepted.
