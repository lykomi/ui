/**
 * The measured width of an element, or `undefined` until it has one. Lists
 * use it to decide which columns fit: a table beside an open detail pane is
 * narrower than the window, and only the table knows by how much.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useElementWidth(
  ref: RefObject<HTMLElement | null>,
  box: "border" | "client" = "border",
): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);
  // The ref OBJECT is stable while the node it holds may not be: a caller
  // that swaps the element keeps the same ref, and an observer bound once
  // would go on measuring the detached node forever. So the element itself
  // is state, refreshed after every render that changed it.
  const [element, setElement] = useState<HTMLElement | null>(null);
  const seen = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (ref.current === seen.current) return;
    seen.current = ref.current;
    setElement(ref.current);
  });
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const next = box === "client" ? element.clientWidth : element.getBoundingClientRect().width;
      // A zero width means "not laid out yet" (or a test environment); treat
      // it as unmeasured so nothing is hidden on a guess.
      setWidth((current) => (next > 0 && Math.abs((current ?? -1) - next) > 0.5 ? next : current));
    };
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, [element, box]);
  return width;
}
