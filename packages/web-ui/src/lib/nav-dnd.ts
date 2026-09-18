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
 * drag is over them, and WHEN they grow decides whether the sidebar is
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
 * An in-page drag announces itself through `dragstart`. A drag from the
 * desktop does not — the source is outside the document — so the first nav
 * element to see `Files` on a `dragenter` opens the same flag.
 */
type NavDragListener = () => void;
const navDragListeners = new Set<NavDragListener>();
let navDragActive = false;
let navDragCleanupBound = false;

function publishNavDrag(active: boolean): void {
  if (navDragActive === active) return;
  navDragActive = active;
  for (const listener of navDragListeners) listener();
}

/** Every way a drag can end, including the ones that skip `dragend`. */
function bindNavDragCleanup(): void {
  if (navDragCleanupBound || typeof window === "undefined") return;
  navDragCleanupBound = true;
  const end = () => publishNavDrag(false);
  // `dragend` fires on the source after a drop or a cancel, and `drop`
  // covers a source outside the document that has no `dragend` here at all.
  window.addEventListener("dragend", end, true);
  window.addEventListener("drop", end, true);
  // A desktop drag dragged back OUT of the window leaves neither: the last
  // `dragleave` has no `relatedTarget`, which is the only signal it gives.
  window.addEventListener(
    "dragleave",
    (event) => {
      if (!(event as DragEvent).relatedTarget) end();
    },
    true,
  );
}

export function beginNavDrag(): void {
  bindNavDragCleanup();
  publishNavDrag(true);
}

export function endNavDrag(): void {
  publishNavDrag(false);
}

export function subscribeNavDrag(listener: NavDragListener): () => void {
  navDragListeners.add(listener);
  return () => navDragListeners.delete(listener);
}

export function isNavDragActive(): boolean {
  return navDragActive;
}

/** Test seam — a module-level flag outlives a test file otherwise. */
export function __resetNavDragForTest(): void {
  navDragActive = false;
}
