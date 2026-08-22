/**
 * The measured width of an element, or `undefined` until it has one. Lists
 * use it to decide which columns fit: a table beside an open detail pane is
 * narrower than the window, and only the table knows by how much.
 */
import { useEffect, useState, type RefObject } from "react";

export function useElementWidth(ref: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const next = element.getBoundingClientRect().width;
      // A zero width means "not laid out yet" (or a test environment); treat
      // it as unmeasured so nothing is hidden on a guess.
      setWidth((current) => (next > 0 && Math.abs((current ?? -1) - next) > 0.5 ? next : current));
    };
    const observer = new ResizeObserver(read);
    observer.observe(element);
    read();
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
