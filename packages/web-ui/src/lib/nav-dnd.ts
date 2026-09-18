export function hasExternalFilesData(dataTransfer: {
  types: ArrayLike<string>;
  files?: { length: number } | null;
}): boolean {
  return Array.from(dataTransfer.types).includes("Files") || (dataTransfer.files?.length ?? 0) > 0;
}

export function hasAnyDropTarget(isDropTarget: boolean, isFileDropTarget: boolean): boolean {
  return isDropTarget || isFileDropTarget;
}

export function getContainerDropZoneLabel(hasExternalFiles: boolean): string {
  return hasExternalFiles ? "Upload to root" : "Move to root";
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
 * "Before the user has aimed" is the whole value, so the flag opens at the
 * earliest moment each kind of drag can be observed:
 *
 *  - an IN-PAGE drag announces itself with `dragstart`, before any movement;
 *  - a drag from OUTSIDE this document — the desktop, or another window of
 *    the same app — has no `dragstart` here, and its earliest sign is the
 *    first `dragenter` anywhere, usually `<html>` as the pointer crosses the
 *    window edge, long before it reaches a row. A window-level capture
 *    listener sees that one; waiting for a nav element to see it meant the
 *    target row itself opened the reservation and then slid out from under
 *    the stationary pointer.
 *
 * And WHAT is tracked is the gesture's set of MIME types, not just "a drag
 * is happening". Reserving space and painting a label is a promise that a
 * drop will land, so only a zone that would take this particular drag may
 * make it. Two consequences the set — rather than one type — is what gets
 * right:
 *
 *  - `dragstart` BUBBLES, and a draggable row sits inside a draggable
 *    container, so both handlers run and both write to `dataTransfer`. A
 *    single tracked type would be whichever handler ran last (the
 *    ancestor's), leaving zones that match the child's payload shut.
 *  - a `dragenter` from another document carries its custom types, so those
 *    can be adopted the same way `Files` is.
 *
 * The set is read directly and never serialised. It was briefly published as
 * a joined string, for `useSyncExternalStore`'s identity comparison — but a
 * MIME token may legally contain the separator (`|` is not one of RFC 2045's
 * tspecials), and then one type splits into two: the zone that owns it stays
 * shut while a zone matching a fragment opens for data it cannot read. The
 * snapshot is a version counter instead, so there is nothing to encode.
 */
type NavDragListener = () => void;
const navDragListeners = new Set<NavDragListener>();

/** The MIME types this gesture carries. Empty means no drag is in flight. */
const navDragTypes = new Set<string>();
/** Bumped on every change — the `useSyncExternalStore` snapshot. */
let navDragVersion = 0;
/** Did this gesture start HERE? Only then is a `dragend` coming at all. */
let navDragStartedHere = false;
/** The element it started from, when we were given one. Separate from the
 *  flag above: the flag decides whether a `dragend` is owed, this decides
 *  where to listen for it. Conflating them lost an in-page drag the
 *  window-exit protection whenever the caller had no element to pass. */
let navDragSource: Element | null = null;
let navDragWatchBound = false;

/** The type an external file drag announces itself with. */
const FILES_TYPE = "Files";

function publish(): void {
  navDragVersion += 1;
  for (const listener of navDragListeners) listener();
}

function endNavDragInternal(): void {
  navDragStartedHere = false;
  navDragSource = null;
  if (navDragTypes.size === 0) return;
  navDragTypes.clear();
  publish();
}

/**
 * Bind the window-level listeners: the earliest sight of a drag from outside
 * this document, and every way a drag can end — including the ones that skip
 * `dragend`.
 */
function bindNavDragWatch(): void {
  if (navDragWatchBound || typeof window === "undefined") return;
  navDragWatchBound = true;

  // A drag from outside, as early as this document can see it. Capture phase,
  // so it runs before the handler of whatever element the pointer entered.
  window.addEventListener(
    "dragenter",
    (event) => {
      const transfer = (event as DragEvent).dataTransfer;
      if (!transfer) return;
      let added = false;
      for (const type of Array.from(transfer.types)) {
        if (!navDragTypes.has(type)) {
          navDragTypes.add(type);
          added = true;
        }
      }
      // `files.length` is the other way a file drag shows itself.
      if ((transfer.files?.length ?? 0) > 0 && !navDragTypes.has(FILES_TYPE)) {
        navDragTypes.add(FILES_TYPE);
        added = true;
      }
      if (added) publish();
    },
    true,
  );

  // `dragend` fires on the source after a drop or a cancel, and `drop`
  // covers a source outside the document that has no `dragend` here at all.
  window.addEventListener("dragend", endNavDragInternal, true);
  window.addEventListener("drop", endNavDragInternal, true);

  // A drag taken back OUT of the window leaves neither: the last `dragleave`
  // has no `relatedTarget`, which is the only signal it gives.
  //
  // A drag that STARTED here looks identical and is not over — it is still in
  // progress and will come back, and its `dragend` will close it properly.
  // Ending on this collapsed every zone for the rest of that gesture, so the
  // root the user was aiming at simply vanished. Hence the check: only a drag
  // that cannot report its own end is ended here.
  window.addEventListener(
    "dragleave",
    (event) => {
      if ((event as DragEvent).relatedTarget) return;
      if (navDragStartedHere) return;
      endNavDragInternal();
    },
    true,
  );
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
 * without this the reservation would stay open, every zone expanded, with
 * the relatedTarget-less `dragleave` deliberately ignoring an in-page drag.
 */
export function beginNavDrag(type: string, source?: Element | null): void {
  bindNavDragWatch();
  navDragStartedHere = true;
  if (source && source !== navDragSource) {
    navDragSource = source;
    source.addEventListener("dragend", endNavDragInternal, { once: true });
  }
  if (navDragTypes.has(type)) return;
  navDragTypes.add(type);
  publish();
}

export function endNavDrag(): void {
  endNavDragInternal();
}

export function subscribeNavDrag(listener: NavDragListener): () => void {
  bindNavDragWatch();
  navDragListeners.add(listener);
  return () => navDragListeners.delete(listener);
}

export function isNavDragActive(): boolean {
  return navDragTypes.size > 0;
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
 * Would a zone with these capabilities accept the live drag?
 *
 * Reserving space and showing a label is a promise that a drop will land, so
 * only a zone that would actually take this drag may do either. "A drag is
 * happening" was not enough: a container that accepts entity moves but not
 * files advertised "Upload to root" at a file it would refuse, and two
 * modules with different `dnd.type`s opened each other's zones.
 */
export function navDragAccepts(zone: {
  type: string;
  acceptsEntities: boolean;
  acceptsFiles: boolean;
}): boolean {
  if (navDragTypes.size === 0) return false;
  if (zone.acceptsEntities && navDragTypes.has(zone.type)) return true;
  return zone.acceptsFiles && navDragTypes.has(FILES_TYPE);
}

/** Is the live drag carrying files from outside the document? */
export function isNavDragExternal(): boolean {
  return navDragTypes.has(FILES_TYPE);
}

/** Test seam — module-level state outlives a test file otherwise. */
export function __resetNavDragForTest(): void {
  navDragTypes.clear();
  navDragStartedHere = false;
  navDragSource = null;
  navDragVersion = 0;
}
