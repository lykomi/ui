import { useLayoutEffect, useRef, useState } from "react";

/** A retained graph can stay mounted in an inactive window or a hidden legacy panel. */
export function useGraphSurfaceVisible(focused?: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setVisible(!element.closest('[inert], [hidden], [aria-hidden="true"]'));
    update();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement)
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["inert", "hidden", "aria-hidden"],
      });
    return () => observer.disconnect();
  }, [focused]);
  return { ref, visible };
}
