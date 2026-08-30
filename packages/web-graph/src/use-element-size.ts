import { useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Track an element's box.
 *
 * `react-force-graph-2d` takes `width`/`height` as NUMBERS — it sizes the
 * canvas imperatively and has no CSS-driven mode. Without an observer the
 * canvas keeps its first measurement forever, so it goes blank when the tool
 * panel is dragged wider or toggled fullscreen.
 */
export function useElementSize(element: Element | null): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((prev) =>
        // Sub-pixel jitter from a flex parent would otherwise re-render (and
        // re-measure) on every frame.
        Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
}
