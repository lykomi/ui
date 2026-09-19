export function hasExternalFilesData(dataTransfer: {
  types: ArrayLike<string>;
  files?: { length: number } | null;
}): boolean {
  return Array.from(dataTransfer.types).includes("Files") || (dataTransfer.files?.length ?? 0) > 0;
}

export function hasAnyDropTarget(isDropTarget: boolean, isFileDropTarget: boolean): boolean {
  return isDropTarget || isFileDropTarget;
}

/**
 * Is a drag that the nav can accept in flight, anywhere — and what is it?
 *
 * Container drop zones are a 4px strip at rest and a labelled band while a
 * drag is in flight, and WHEN they grow decides whether the sidebar is
 * usable. Growing on hover is the trap, in both available shapes:
 *
 *  - in flow, every row below the strip jumps 24px at the moment the pointer
 *    crosses it — which is the moment the user is aiming at one of them, so
 *    the destination walks away from the cursor;
 *  - out of flow, nothing moves, but the expanded band then covers ~12px of
 *    the rows on either side and takes their drops.
 *
 * So the space is reserved for the whole drag instead. The layout settles
 * once, before the user has aimed at anything, and from then on every zone's
 * hit area is exactly the band that is painted — no moving target, and no
 * neighbour quietly answering for another.
 *
 * "Before the user has aimed" is the whole value, and it is also the whole
 * PRECONDITION. Only a drag that starts in this document has a moment before
 * the aim: `dragstart` fires before any movement, so the layout can settle
 * while the pointer is still on the row being picked up.
 *
 * A drag arriving from OUTSIDE — the desktop, or another window — has no such
 * moment. The browser hit-tests whatever is under the pointer before any
 * script runs, so the first `dragenter` this document sees is already aimed
 * at something; opening the zones from it moves that something out from under
 * a stationary pointer. That is the very failure this whole change exists to
 * remove, arriving by a different road.
 *
 * So outside drags get no reservation: the strips stay 4px and nothing moves.
 * They are not left without a target — container rows accept and highlight
 * file drops themselves, which is the path a file drag was always going to
 * take. The root-drop affordance is a convenience with a redundant route; the
 * mis-aim was a correctness failure with none.
 *
 * WHAT is tracked is the gesture's set of MIME types, not just "a drag is
 * happening". Reserving space and painting a label is a promise that a drop
 * will land, so only a zone that would take this particular drag may make it.
 * A set rather than one type because `dragstart` BUBBLES: a draggable row
 * sits inside a draggable container, both handlers run, and tracking one
 * would track whichever ran last — the ancestor's — leaving zones that match
 * the child's payload shut.
 *
 * The set is read directly and never serialised. It was briefly published as
 * a joined string, for `useSyncExternalStore`'s identity comparison — but a
 * MIME token may legally contain the separator (`|` is not one of RFC 2045's
 * tspecials), and then one type splits into two. The snapshot is a version
 * counter instead, so there is nothing to encode.
 */
type NavDragListener = () => void;
const navDragListeners = new Set<NavDragListener>();

/** The MIME types this gesture carries. Empty means no drag is in flight. */
const navDragTypes = new Set<string>();
/** Bumped on every change — the `useSyncExternalStore` snapshot. */
let navDragVersion = 0;
/** The element the drag started from, when we were given one — so its
 *  `dragend` is heard even after a nav refresh detaches it mid-drag. */
let navDragSource: Element | null = null;
let navDragWatchBound = false;

function publish(): void {
  navDragVersion += 1;
  for (const listener of navDragListeners) listener();
}

/**
 * Ends whatever drag is in flight.
 *
 * Bound to the window for `dragend` (a drop or a cancel) and `drop` (a
 * source outside this document, which has no `dragend` here at all), and to
 * the source element itself, whose own `dragend` is the only one left once a
 * nav refresh has detached it.
 *
 * There is deliberately no `dragleave` ending. A relatedTarget-less
 * `dragleave` is the only signal a drag leaving the window gives, and it is
 * the same signal whether the drag is over or merely outside — so it ended
 * live in-page drags, collapsing every zone for the rest of the gesture. It
 * existed for drags with no `dragend` in this document, and none of those
 * opens a reservation now.
 */
export function endNavDrag(): void {
  navDragSource = null;
  if (navDragTypes.size === 0) return;
  navDragTypes.clear();
  publish();
}

function bindNavDragWatch(): void {
  if (navDragWatchBound || typeof window === "undefined") return;
  navDragWatchBound = true;
  window.addEventListener("dragend", endNavDrag, true);
  window.addEventListener("drop", endNavDrag, true);
}

/**
 * Called from `dragstart` on a nav row, with the MIME type that row wrote its
 * payload under and the element it started from.
 *
 * The type ADDS rather than replaces: `dragstart` bubbles through every
 * draggable ancestor, and each one's type belongs to the same gesture.
 *
 * The source is held so its `dragend` can be heard even after a nav refresh
 * has removed the row mid-drag. A detached node still receives its own
 * `dragend`, but the event reaches no window listener from there — so
 * without this the reservation would stay open, every zone expanded, until
 * some later drag happened to finish elsewhere.
 */
export function beginNavDrag(type: string, source?: Element | null): void {
  bindNavDragWatch();
  if (source && source !== navDragSource) {
    navDragSource = source;
    source.addEventListener("dragend", endNavDrag, { once: true });
  }
  if (navDragTypes.has(type)) return;
  navDragTypes.add(type);
  publish();
}

export function subscribeNavDrag(listener: NavDragListener): () => void {
  bindNavDragWatch();
  navDragListeners.add(listener);
  return () => navDragListeners.delete(listener);
}

/**
 * The snapshot `useSyncExternalStore` compares: a version, bumped on every
 * change. A primitive, so identity comparison is meaningful, and carrying no
 * encoding of its own — see the note about `|` above.
 */
export function getNavDragVersion(): number {
  return navDragVersion;
}

/**
 * Would a zone with this `dnd.type` accept the live drag?
 *
 * Reserving space and painting a label is a promise that a drop will land,
 * so only a zone that would actually take this drag may do either. "A drag
 * is happening" was not enough: two modules with different `dnd.type`s
 * opened each other's zones.
 *
 * Files need no case here. Only a nav row's `dragstart` opens a reservation
 * and those carry an entity, so no zone ever opens for a file drag whatever
 * it is configured to accept. It still HANDLES one — the resting strip takes
 * a file drop like any other target — and the container's own row advertises
 * that same drop at full size.
 */
export function navDragAccepts(zone: { type: string; acceptsEntities: boolean }): boolean {
  return zone.acceptsEntities && navDragTypes.has(zone.type);
}

/** Test seam — module-level state outlives a test file otherwise. */
export function __resetNavDragForTest(): void {
  navDragTypes.clear();
  navDragSource = null;
  navDragVersion = 0;
}
