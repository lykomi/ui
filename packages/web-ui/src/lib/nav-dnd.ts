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
/**
 * The live drag, as one string: `"external:Files"`, or `"internal:<mime>"`
 * for the MIME type the source wrote.
 *
 * A string rather than an object because `useSyncExternalStore` compares
 * snapshots by identity, and it carries the MIME type because "some drag is
 * happening" is not enough to decide anything: a zone that takes entity
 * moves but no files, or one belonging to a module with a different
 * `dnd.type`, must not reserve space or offer a label for a drag it would
 * refuse.
 */
let navDragSignature: string | null = null;
let navDragWatchBound = false;

function publishNavDrag(signature: string | null): void {
  if (navDragSignature === signature) return;
  navDragSignature = signature;
  navDragActive = signature !== null;
  for (const listener of navDragListeners) listener();
}

/**
 * Bind the window-level listeners: the earliest sight of a desktop drag, and
 * every way a drag can end — including the ones that skip `dragend`.
 */
function bindNavDragWatch(): void {
  if (navDragWatchBound || typeof window === "undefined") return;
  navDragWatchBound = true;
  const end = () => publishNavDrag(null);

  // A desktop drag, as early as this document can see it. Capture phase, so
  // it runs before the handler of whatever element the pointer entered.
  window.addEventListener(
    "dragenter",
    (event) => {
      const transfer = (event as DragEvent).dataTransfer;
      if (transfer && hasExternalFilesData(transfer)) publishNavDrag(EXTERNAL_SIGNATURE);
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
      if (navDragSignature?.startsWith("internal:")) return;
      end();
    },
    true,
  );
}

/** The one signature an external drag can have — its only "type" is `Files`. */
const EXTERNAL_SIGNATURE = "external:Files";

/**
 * Called from `dragstart` on a nav row — an in-page drag carrying `type`,
 * the MIME type the source wrote its payload under.
 */
export function beginNavDrag(type: string): void {
  bindNavDragWatch();
  publishNavDrag(`internal:${type}`);
}

export function endNavDrag(): void {
  publishNavDrag(null);
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
 * The live drag's signature, or null if none is in flight.
 *
 * A zone is open before the pointer reaches it, so nothing about the drag
 * can be read off the zone's own hover state any more — during a desktop
 * file drag every zone would sit reading "Move to root" until entered, and
 * promise the wrong thing about the drop for the whole approach. What the
 * drag is belongs to the drag, so it is published with it.
 */
export function getNavDragSignature(): string | null {
  return navDragSignature;
}

/**
 * Would a zone with these capabilities accept the live drag?
 *
 * Reserving space and showing a label is a promise that a drop will land,
 * so only a zone that would actually take this drag may do either. The
 * global flag alone was not enough: a container that accepts entity moves
 * but not files advertised "Upload to root" at a desktop file it would
 * refuse, and two modules with different `dnd.type`s opened each other's
 * zones. The MIME type in the signature is what settles both.
 */
export function navDragAccepts(
  signature: string | null,
  zone: { type: string; acceptsEntities: boolean; acceptsFiles: boolean },
): boolean {
  if (signature === null) return false;
  if (signature === EXTERNAL_SIGNATURE) return zone.acceptsFiles;
  return zone.acceptsEntities && signature === `internal:${zone.type}`;
}

/** Is the live drag carrying files from outside the document? */
export function isNavDragExternal(signature: string | null): boolean {
  return signature === EXTERNAL_SIGNATURE;
}

/** Test seam — a module-level flag outlives a test file otherwise. */
export function __resetNavDragForTest(): void {
  navDragActive = false;
  navDragSignature = null;
}
