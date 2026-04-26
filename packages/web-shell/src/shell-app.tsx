import { type ReactNode, Suspense, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { AGUIRuntimeProvider } from "@lastspace/web-ui";
import type { ThemeLayer } from "@lastspace/web-ui";
import type { ChatModule, AuthAdapter, ShellPage } from "./types.ts";
import { ShellAuth } from "./auth-default.tsx";
import { ShellLayout } from "./shell-layout.tsx";
import { defaultAgentFetch } from "./service-fetch-default.ts";

interface ShellAppProps {
  modules: ChatModule[];
  pages: ShellPage[];
  baseThemeLayers: ThemeLayer[];
  authProvider?: AuthAdapter;
  /** Test seam — overrides defaultAgentFetch. */
  agentFetch?: typeof fetch;
}

/**
 * Inner shell component — pure React (no `createRoot`). Imported by
 * `bootstrap-shell.tsx` for production and by `__tests__/` for assertions.
 *
 * Wrapper ordering is contractual; see `wrapper-order.test.tsx`.
 */
export function ShellApp({
  modules,
  pages,
  baseThemeLayers,
  authProvider,
  agentFetch,
}: ShellAppProps) {
  // Merge module pages with customer pages — customer wins on path collision
  // (last-wins). Stable order: customer pages first (they appear in Routes
  // before module pages, and React Router matches the FIRST matching route).
  const mergedPages = useMemo(() => {
    const seen = new Set(pages.map((p) => p.path));
    const moduleRoutes: ShellPage[] = [];
    for (const m of modules) {
      for (const p of m.pages ?? []) {
        if (!seen.has(p.path)) {
          seen.add(p.path);
          moduleRoutes.push(p);
        }
      }
    }
    return [...pages, ...moduleRoutes];
  }, [pages, modules]);

  // Compose module wrappers outer→inner from each module's array.
  const wrappers = useMemo(() => {
    const out: React.ComponentType<{ children: ReactNode }>[] = [];
    for (const m of modules) {
      for (const W of m.wrappers ?? []) out.push(W);
    }
    return out;
  }, [modules]);

  // Aggregate module toolUIs.
  const toolUIs: ReactNode[] = [];
  for (const m of modules) {
    if (m.toolUIs) {
      toolUIs.push(<ToolUIGroup key={m.name}>{m.toolUIs}</ToolUIGroup>);
    }
  }

  const fetchFn = agentFetch ?? defaultAgentFetch;

  return (
    <BrowserRouter>
      <ShellAuth adapter={authProvider}>
        <ComposedWrappers wrappers={wrappers}>
          <AGUIRuntimeProvider fetchFn={fetchFn}>
            {toolUIs}
            <Suspense fallback={null}>
              <Routes>
                <Route element={<ShellLayout modules={modules} baseThemeLayers={baseThemeLayers} />}>
                  {mergedPages.map((p) => (
                    <Route key={p.path} path={p.path === "/" ? undefined : p.path} index={p.path === "/"} element={p.element} />
                  ))}
                </Route>
              </Routes>
            </Suspense>
          </AGUIRuntimeProvider>
        </ComposedWrappers>
      </ShellAuth>
    </BrowserRouter>
  );
}

function ToolUIGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

interface ComposedWrappersProps {
  wrappers: React.ComponentType<{ children: ReactNode }>[];
  children: ReactNode;
}

/**
 * Apply the wrappers array outer→inner. wrappers[0] is the outermost; the
 * last entry is closest to children. Pure render-time composition; no state.
 */
function ComposedWrappers({ wrappers, children }: ComposedWrappersProps) {
  let tree: ReactNode = children;
  // Iterate in reverse so wrappers[0] ends up outermost.
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const W = wrappers[i];
    tree = <W>{tree}</W>;
  }
  return <>{tree}</>;
}
