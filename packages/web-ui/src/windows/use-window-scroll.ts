import { useLayoutEffect, useRef, type UIEvent } from "react";

/** Capture while visible: browsers can report zero offsets once a pane is hidden. */
export function useWindowScroll(visible: boolean, panels: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const offsets = useRef(new Map<HTMLElement, { top: number; left: number }>());
  useLayoutEffect(() => {
    const element = ref.current;
    if (!visible || !element) return;
    for (const [node, offset] of offsets.current) {
      if (!element.contains(node)) {
        offsets.current.delete(node);
        continue;
      }
      node.scrollTop = offset.top;
      node.scrollLeft = offset.left;
    }
  }, [visible, panels]);
  const onScrollCapture = (event: UIEvent<HTMLDivElement>) => {
    if (!visible || event.currentTarget.closest("[hidden]")) return;
    const node = event.target;
    if (node instanceof HTMLElement)
      offsets.current.set(node, { top: node.scrollTop, left: node.scrollLeft });
  };
  return { ref, onScrollCapture };
}
