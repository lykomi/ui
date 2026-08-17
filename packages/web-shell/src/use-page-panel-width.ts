/**
 * Width of the page panel beside the chat in expanded ("medium") mode.
 *
 * The navigation sidebar is resizable; this split was a hardcoded 600px, so
 * the chat/content ratio was fixed no matter the screen or the task. Users
 * comparing us to ChatGPT/Claude expect to drag it. Clamped so neither side
 * collapses, and persisted per user.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const MIN_PAGE_PANEL_WIDTH = 360;
/** The chat column must stay usable too. */
const MIN_CHAT_WIDTH = 420;

/**
 * Narrowest viewport that can show chat and page side by side.
 *
 * Both minimums have to fit, so this IS the breakpoint — the layout used a
 * hand-picked `xl` (1280px) instead, which hid the page on every window
 * between 780 and 1280. Expanding the chat next to an open document made the
 * document vanish, on a perfectly ordinary laptop width.
 *
 * `shell-layout.tsx` cannot interpolate this into a Tailwind class (they must
 * be static strings), so it hardcodes `min-[780px]:` and a unit test asserts
 * the two agree.
 */
export const SIDE_BY_SIDE_MIN_VIEWPORT = MIN_PAGE_PANEL_WIDTH + MIN_CHAT_WIDTH;

/**
 * The width literally written into `shell-layout.tsx`'s `min-[780px]:`
 * classes. Tailwind only sees static class strings, so the number cannot be
 * interpolated from {@link SIDE_BY_SIDE_MIN_VIEWPORT} — it is duplicated by
 * necessity, and `side-by-side-breakpoint` fails the build if the two ever
 * disagree. Change one, change the class, or the test stops you.
 */
export const SIDE_BY_SIDE_BREAKPOINT_PX = 780;
const DEFAULT_PAGE_PANEL_WIDTH = 600;
const STORAGE_KEY = "foundry.pagePanel.width";

export function clampPagePanelWidth(desired: number, viewport: number): number {
  const max = Math.max(MIN_PAGE_PANEL_WIDTH, viewport - MIN_CHAT_WIDTH);
  return Math.round(Math.min(max, Math.max(MIN_PAGE_PANEL_WIDTH, desired)));
}

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null; // storage disabled — fall back to the default
  }
}

export function usePagePanelWidth() {
  const [width, setWidthState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PAGE_PANEL_WIDTH;
    return clampPagePanelWidth(readStored() ?? DEFAULT_PAGE_PANEL_WIDTH, window.innerWidth);
  });
  const dragPointerId = useRef<number | null>(null);

  const applyWidth = useCallback((resolve: (prev: number) => number, persist = true) => {
    if (typeof window === "undefined") return;
    setWidthState((prev) => {
      const clamped = clampPagePanelWidth(resolve(prev), window.innerWidth);
      // A drag fires pointermove every frame; writing localStorage each time
      // is a synchronous main-thread write per frame for a value only the
      // final position of which matters. Live moves skip the write and the
      // drag persists once, on release.
      if (persist) {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(clamped));
        } catch {
          // best-effort; the change still applies for this session
        }
      }
      return clamped;
    });
  }, []);

  const setWidth = useCallback((next: number) => applyWidth(() => next), [applyWidth]);

  /** Relative nudge — resolved against the LATEST width, so held/repeated
   * arrow keys accumulate instead of all reading the same stale value. */
  const nudgeWidth = useCallback(
    (delta: number) => applyWidth((prev) => prev + delta),
    [applyWidth],
  );

  // Re-clamp on viewport changes so a narrower window can never strand the
  // chat column off-screen.
  useEffect(() => {
    const onResize = () => setWidthState((w) => clampPagePanelWidth(w, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drag listeners live in an effect and end on pointerup OR pointercancel,
  // so a cancelled drag can never leave the document unselectable.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (dragPointerId.current === null) return;
      applyWidth(() => window.innerWidth - event.clientX, false);
    };
    const onEnd = (event: PointerEvent) => {
      if (dragPointerId.current !== null && event.pointerId !== dragPointerId.current) return;
      const wasDragging = dragPointerId.current !== null;
      dragPointerId.current = null;
      // Persist the position the drag actually landed on.
      if (wasDragging) applyWidth((prev) => prev);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [applyWidth]);

  const startDrag = useCallback((pointerId: number) => {
    dragPointerId.current = pointerId;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const maxWidth =
    typeof window === "undefined"
      ? DEFAULT_PAGE_PANEL_WIDTH
      : clampPagePanelWidth(Number.POSITIVE_INFINITY, window.innerWidth);

  return { width, setWidth, nudgeWidth, startDrag, maxWidth };
}
