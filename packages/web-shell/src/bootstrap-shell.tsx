import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShellApp } from "./shell-app.tsx";
import type { BootstrapShellOptions } from "./types.ts";

/**
 * Mount the agent UI into the DOM.
 *
 * Composition pipeline:
 *   1. Run each module's `fetchInterceptor` (BEFORE createRoot so window.fetch
 *      wrappers are in place by the first React render).
 *   2. createRoot on `rootElement` (default: #root).
 *   3. Wrap `<ShellApp>` in <StrictMode> unless `strictMode === false`.
 */
export function bootstrapShell(opts: BootstrapShellOptions = {}): void {
  const {
    modules = [],
    pages = [],
    theme = [],
    authProvider,
    agentFetch,
    defaultSideChatCollapsed,
    strictMode = true,
    rootElement,
  } = opts;

  // 1. Install module fetch interceptors before React mounts.
  for (const m of modules) {
    m.fetchInterceptor?.();
  }

  // 2. Resolve mount target.
  const root = rootElement ?? document.getElementById("root");
  if (!root) {
    throw new Error(
      "[@iloveagents/foundry-web-shell] No mount target — pass `rootElement` or ensure a #root element exists.",
    );
  }

  const tree = (
    <ShellApp
      modules={modules}
      pages={pages}
      baseThemeLayers={theme}
      authProvider={authProvider}
      agentFetch={agentFetch}
      defaultSideChatCollapsed={defaultSideChatCollapsed}
    />
  );

  // 3. Mount with StrictMode by default.
  createRoot(root).render(strictMode ? <StrictMode>{tree}</StrictMode> : tree);
}
