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
  return (
    <div
      className={className}
      style={{ ...runtime.variables, fontFamily: "var(--font-body)", ...style }}
    >
      {children}
    </div>
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
