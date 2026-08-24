import {
  createContext,
  useContext,
  useEffect,
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
  useEffect(() => {
    if (nested || typeof document === "undefined") return;
    const root = document.documentElement;
    const applied = Object.entries(runtime.variables as Record<string, string>);
    const previous = applied.map(([name]) => [name, root.style.getPropertyValue(name)] as const);
    for (const [name, value] of applied) root.style.setProperty(name, String(value));
    return () => {
      // Restore, rather than remove: another provider may have set these
      // before us, and clearing them would strip a theme we did not own.
      for (const [name, value] of previous) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
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
