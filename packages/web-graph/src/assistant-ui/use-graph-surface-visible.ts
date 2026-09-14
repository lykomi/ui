import { useLayoutEffect, useRef, useState } from "react";

/** A retained graph can stay mounted in an inactive window or a hidden legacy panel. */
export function useGraphSurfaceVisible(focused?: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const dialog = element.closest('[role="dialog"]');
      const sourceGraph = dialog?.querySelector("[data-focus-source-title] [data-graph-surface]");
      setVisible(
        !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
          element.getClientRects().length > 0 &&
          (!sourceGraph || sourceGraph === element),
      );
    };
    update();
    window.addEventListener("resize", update);
    if (typeof MutationObserver === "undefined")
      return () => window.removeEventListener("resize", update);
    const observer = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement)
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["inert", "hidden", "aria-hidden", "class", "style"],
      });
    const dialog = element.closest('[role="dialog"]');
    if (dialog) observer.observe(dialog, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [focused]);
  return { ref, visible };
}
