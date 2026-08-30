import { useEffect, useState } from "react";
import { FALLBACK_THEME, resolveGraphTheme, type GraphTheme } from "./theme.ts";

const sameTheme = (a: GraphTheme, b: GraphTheme): boolean =>
  a.foreground === b.foreground &&
  a.mutedForeground === b.mutedForeground &&
  a.background === b.background &&
  a.border === b.border &&
  a.ring === b.ring &&
  a.palette.length === b.palette.length &&
  a.palette.every((colour, index) => colour === b.palette[index]);

/**
 * Keep {@link GraphTheme} in sync with the DOM.
 *
 * Re-resolves when the `class`, `data-theme` or `style` attribute changes
 * anywhere up the tree — between them that is how every theme switcher in this
 * stack signals a flip (Tailwind's `.dark` class, an explicit `data-theme`, or
 * a runtime layer writing variables inline). Watching the element itself is not
 * enough: the class usually lands on `<html>`, far above.
 */
export function useGraphTheme(element: Element | null): GraphTheme {
  const [theme, setTheme] = useState<GraphTheme>(FALLBACK_THEME);

  useEffect(() => {
    if (!element) return;
    // Keep the previous object when nothing resolved differently. `theme` is a
    // dependency of the canvas painters and of `styleMap`, so a fresh object
    // per mutation is a re-render and a full repaint — and `style` mutations
    // are not rare: an ancestor's inline width changes on every frame of a
    // panel drag-resize.
    const sync = () =>
      setTheme((previous) => {
        const next = resolveGraphTheme(element);
        return sameTheme(previous, next) ? previous : next;
      });
    sync();

    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(sync);
    // Observe every ancestor: the theme class can sit on <html>, on a
    // ThemeScope wrapper, or on the container itself.
    //
    // `style` is in the filter because a RUNTIME theme layer never touches a
    // class. `ThemeRuntimeProvider` publishes its variables with
    // `root.style.setProperty(...)`, so switching one changed the DOM while
    // the canvas went on painting the previous palette — until some unrelated
    // class or `data-theme` mutation happened to wake this up.
    for (let node: Element | null = element; node; node = node.parentElement) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }
    return () => observer.disconnect();
  }, [element]);

  return theme;
}
