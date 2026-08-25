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

// --- Document-level theme ownership -----------------------------------------
//
// Two outer `ThemeScope`s can be mounted independently, and a per-effect
// snapshot is only correct if they unmount in the reverse of their mount
// order. A writes blue; B snapshots blue and writes green; A unmounts and
// correctly leaves green alone; then B unmounts and restores its snapshot —
// blue — even though A is long gone, leaving the document themed by nobody
// (review catch).
//
// So ownership is tracked rather than inferred: a stack of who has written,
// and one snapshot of what was there before the FIRST of them. Whoever is on
// top is applied; a scope leaving pops itself wherever it sits and the new
// top is applied; when the last one leaves the original values come back.
// Correct in any order, because it never has to guess who owns what.
type RootThemeWrite = { id: symbol; vars: Record<string, string> };
const rootThemeStack: RootThemeWrite[] = [];
const rootThemeBase = new Map<string, { value: string; priority: string }>();

function applyTopRootTheme(root: HTMLElement): void {
  const top = rootThemeStack[rootThemeStack.length - 1];
  for (const [name, base] of rootThemeBase) {
    const next = top?.vars[name];
    if (next !== undefined) {
      root.style.setProperty(name, String(next));
    } else if (base.value) {
      // Value AND priority: a host token declared `!important` keeps its
      // flag, or anything else can start overriding a theme it owns.
      root.style.setProperty(name, base.value, base.priority);
    } else {
      root.style.removeProperty(name);
    }
  }
}

/** Publish `vars` on the document until the returned cleanup runs. */
function pushRootTheme(root: HTMLElement, vars: Record<string, string>): () => void {
  for (const name of Object.keys(vars)) {
    if (!rootThemeBase.has(name)) {
      rootThemeBase.set(name, {
        value: root.style.getPropertyValue(name),
        priority: root.style.getPropertyPriority(name),
      });
    }
  }
  const id = Symbol("theme-scope");
  rootThemeStack.push({ id, vars });
  applyTopRootTheme(root);
  return () => {
    const at = rootThemeStack.findIndex((write) => write.id === id);
    if (at >= 0) rootThemeStack.splice(at, 1);
    applyTopRootTheme(root);
    if (rootThemeStack.length === 0) rootThemeBase.clear();
  };
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
    // `font-family` rides along as one more name: `<html>` needs it set,
    // not just `--font-body` defined, or portalled content keeps the host's
    // font (review catch).
    const vars: Record<string, string> = {
      ...(runtime.variables as Record<string, string>),
      "font-family": "var(--font-body)",
    };
    return pushRootTheme(root, vars);
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
