import { useEffect, useState } from "react";
import { FALLBACK_THEME, resolveGraphTheme, type GraphTheme } from "./theme.ts";

/**
 * Keep {@link GraphTheme} in sync with the DOM.
 *
 * Re-resolves when the `class` or `data-theme` attribute changes anywhere up
 * the tree — that is how every theme switcher in this stack signals a flip
 * (Tailwind's `.dark` class, or an explicit `data-theme`). Watching the element
 * itself is not enough: the class usually lands on `<html>`, far above.
 */
export function useGraphTheme(element: Element | null): GraphTheme {
  const [theme, setTheme] = useState<GraphTheme>(FALLBACK_THEME);

  useEffect(() => {
    if (!element) return;
    const sync = () => setTheme(resolveGraphTheme(element));
    sync();

    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(sync);
    // Observe every ancestor: the theme class can sit on <html>, on a
    // ThemeScope wrapper, or on the container itself.
    for (let node: Element | null = element; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ["class", "data-theme"] });
    }
    return () => observer.disconnect();
  }, [element]);

  return theme;
}
