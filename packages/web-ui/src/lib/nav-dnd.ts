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
 * Is a drag that the nav can accept in flight, anywhere?
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
 *  - a DESKTOP drag has no `dragstart` here, and its earliest sign is the
 *    first `dragenter` anywhere in the document — usually `<html>` as the
 *    pointer crosses the window edge, long before it reaches a row. A
 *    window-level capture listener sees that one; waiting for a nav element
 *    to see it meant the target row itself opened the reservation and then
 *    slid out from under the stationary pointer.
 */
type NavDragListener = () => void;
const navDragListeners = new Set<NavDragListener>();
let navDragActive = false;
/** Where the live drag came from — it decides which endings apply. */
let navDragSource: "internal" | "external" | null = null;
let navDragWatchBound = false;

function publishNavDrag(active: boolean, source: "internal" | "external" | null): void {
  const next = active ? source : null;
  if (navDragActive === active && navDragSource === next) return;
  navDragActive = active;
  navDragSource = next;
  for (const listener of navDragListeners) listener();
}

/**
 * Bind the window-level listeners: the earliest sight of a desktop drag, and
 * every way a drag can end — including the ones that skip `dragend`.
 */
function bindNavDragWatch(): void {
  if (navDragWatchBound || typeof window === "undefined") return;
  navDragWatchBound = true;
  const end = () => publishNavDrag(false, null);

  // A desktop drag, as early as this document can see it. Capture phase, so
  // it runs before the handler of whatever element the pointer entered.
  window.addEventListener(
    "dragenter",
    (event) => {
      const transfer = (event as DragEvent).dataTransfer;
      if (transfer && hasExternalFilesData(transfer)) publishNavDrag(true, "external");
    },
    true,
  );

  // `dragend` fires on the source after a drop or a cancel, and `drop`
  // covers a source outside the document that has no `dragend` here at all.
  window.addEventListener("dragend", end, true);
  window.addEventListener("drop", end, true);

  // A desktop drag dragged back OUT of the window leaves neither: the last
  // `dragleave` has no `relatedTarget`, which is the only signal it gives.
  //
  // An IN-PAGE drag leaving the window looks identical and is not over — it
  // is still in progress and will come back, and `dragend` will close it
  // properly. Ending on this would collapse every zone for the rest of that
  // gesture, so the root the user was aiming at simply vanishes. Hence the
  // source check: only the drag that cannot report its own end is ended here.
  window.addEventListener(
    "dragleave",
    (event) => {
      if ((event as DragEvent).relatedTarget) return;
      if (navDragSource === "internal") return;
      end();
    },
    true,
  );
}

/** Called from `dragstart` on a nav row — an in-page drag. */
export function beginNavDrag(): void {
  bindNavDragWatch();
  publishNavDrag(true, "internal");
}

export function endNavDrag(): void {
  publishNavDrag(false, null);
}

export function subscribeNavDrag(listener: NavDragListener): () => void {
  bindNavDragWatch();
  navDragListeners.add(listener);
  return () => navDragListeners.delete(listener);
}

export function isNavDragActive(): boolean {
  return navDragActive;
}

/**
 * What KIND of drag is in flight, or null if none is.
 *
 * A zone is now open before the pointer reaches it, so its label can no
 * longer be read off its own hover state: during a desktop file drag every
 * zone would sit there reading "Move to root" until entered, and promise
 * the wrong thing about the drop for the whole approach. The kind belongs
 * to the drag, so it is published with it.
 */
export function getNavDragKind(): "internal" | "external" | null {
  return navDragSource;
}

/** Test seam — a module-level flag outlives a test file otherwise. */
export function __resetNavDragForTest(): void {
  navDragActive = false;
  navDragSource = null;
}
