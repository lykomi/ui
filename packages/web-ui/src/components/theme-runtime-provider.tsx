import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ThemeMode } from "../lib/theme-store.ts";
import {
  resolveThemeRuntime,
  type ResolvedThemeRuntime,
  type ThemeLayer,
} from "../lib/theme-runtime.ts";

const ThemeRuntimeContext = createContext<ResolvedThemeRuntime | null>(null);

/** True inside a ThemeScope — the outermost one owns the document. */
const ThemeScopeNestedContext = createContext(false);

export function ThemeRuntimeProvider({
  layers,
  mode,
  children,
}: {
  layers: ThemeLayer[];
  mode: ThemeMode;
  children: ReactNode;
}) {
  const fallback = useRef<ResolvedThemeRuntime>(resolveThemeRuntime([], "system"));
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    setSystemPrefersDark(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mode]);

  const runtime = useMemo(() => {
    try {
      const next = resolveThemeRuntime(layers, mode);
      fallback.current = next;
      return next;
    } catch {
      return fallback.current;
    }
  }, [layers, mode, systemPrefersDark]);

  return <ThemeRuntimeContext.Provider value={runtime}>{children}</ThemeRuntimeContext.Provider>;
}

export function useThemeRuntime(): ResolvedThemeRuntime {
  return useContext(ThemeRuntimeContext) ?? resolveThemeRuntime([], "system");
}

export function ThemeScope({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const runtime = useThemeRuntime();
  const nested = useContext(ThemeScopeNestedContext);

  // Variables on this div alone reach only what renders INSIDE it. Radix
  // portals mount into document.body, outside it, so every dropdown,
  // popover, select and tooltip fell back to :root — the base preset —
  // while the page around them wore the customer's theme. `dialog` papered
  // over its own case with a nested ThemeScope; that fixes one portal and
  // leaves the next one to rediscover the bug.
  //
  // The outermost scope publishes to the document element instead, so
  // anything portalled anywhere inherits. Nested scopes keep the div only:
  // they exist to theme a subtree differently, and must not overwrite the
  // document with their own values.
  //
  // Residual, stated because it is a real limit and not an oversight: a
  // NESTED scope's own portalled content still resolves the document's
  // (outermost) theme, because the portal escapes the nested div and the
  // nested scope deliberately does not publish. That is strictly better
  // than before — such content used to get the base `:root` preset rather
  // than any theme at all — and the remedy already exists and is used:
  // wrap the portalled content in a `ThemeScope`, as `ui/dialog.tsx` does
  // with `display: contents`. Context reaches through a portal, so the
  // nested scope's variables land on the portalled subtree (review catch).
  // BEFORE paint, not after. A portal that exists on the very first render —
  // a default-open dialog, an overlay restored during hydration — would
  // otherwise paint once against the base `:root` preset and then correct
  // itself: the mismatched-theme flash this exists to remove, in miniature
  // (review catch).
  useLayoutEffect(() => {
    if (nested || typeof document === "undefined") return;
    const root = document.documentElement;
    const applied = Object.entries(runtime.variables as Record<string, string>);
    // Value AND priority. A host that declared a root token `!important`
    // gets the text back on cleanup but silently loses the flag otherwise,
    // so anything else can start overriding a theme it owns (review catch).
    const previous = applied.map(
      ([name]) =>
        [name, root.style.getPropertyValue(name), root.style.getPropertyPriority(name)] as const,
    );
    // The themed body font has to reach portalled content too. The scoped
    // div sets `font-family` explicitly; `<html>` was given only the custom
    // property, and defining `--font-body` does not itself change the font —
    // so dropdowns and tooltips under `document.body` kept the host's
    // (review catch).
    const previousFont = root.style.getPropertyValue("font-family");
    const previousFontPriority = root.style.getPropertyPriority("font-family");
    for (const [name, value] of applied) root.style.setProperty(name, String(value));
    root.style.setProperty("font-family", "var(--font-body)");
    return () => {
      // Restore, rather than remove: another provider may have set these
      // before us, and clearing them would strip a theme we did not own.
      //
      // And only where WE are still the last writer. Another scope or a host
      // theme manager can write one of these after us, and restoring a stale
      // snapshot over it clobbers the live owner's value (review catch).
      const restore = (name: string, value: string, priority: string, mine: string) => {
        if (root.style.getPropertyValue(name) !== mine) return;
        if (value) root.style.setProperty(name, value, priority);
        else root.style.removeProperty(name);
      };
      for (const [name, value, priority] of previous) {
        const mine = String(
          (runtime.variables as Record<string, string>)[name] ?? "",
        );
        restore(name, value, priority, mine);
      }
      restore("font-family", previousFont, previousFontPriority, "var(--font-body)");
    };
  }, [nested, runtime.variables]);

  return (
    <ThemeScopeNestedContext.Provider value={true}>
      <div
        className={className}
        style={{ ...runtime.variables, fontFamily: "var(--font-body)", ...style }}
      >
        {children}
      </div>
    </ThemeScopeNestedContext.Provider>
  );
}

export function ThemeDocumentMetadata() {
  const runtime = useThemeRuntime();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = runtime.branding.appTitle || runtime.branding.appName || "Foundry UI";
  }, [runtime.branding.appName, runtime.branding.appTitle]);

  return null;
}
