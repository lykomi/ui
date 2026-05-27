import { type ReactNode, Suspense, useCallback, useMemo, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router";
import { AGUIRuntimeProvider } from "@iloveagents/foundry-web-ui";
import type {
  AGUIChatConversationFactoryArgs,
  AGUIHistoryAdapterFactory,
} from "@iloveagents/foundry-web-ui";
import type { ThemeLayer } from "@iloveagents/foundry-web-ui";
import type { ChatConversationConfig, ChatModule, AuthAdapter, ShellPage } from "./types.ts";
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

  // Aggregate chatConversation configs from all modules. First-match
  // wins at URL-match time (rare to have more than one anyway).
  const chatConversationConfigs = useMemo(
    () => modules.flatMap((m) => (m.chatConversation ? [m.chatConversation] : [])),
    [modules],
  );

  return (
    <BrowserRouter>
      <ShellAuth adapter={authProvider}>
        <ComposedWrappers wrappers={wrappers}>
          <ChatConversationAwareRuntime
            fetchFn={fetchFn}
            configs={chatConversationConfigs}
            toolUIs={toolUIs}
          >
            <Suspense fallback={null}>
              <Routes>
                <Route element={<ShellLayout modules={modules} baseThemeLayers={baseThemeLayers} />}>
                  {mergedPages.map((p) => (
                    <Route key={p.path} path={p.path === "/" ? undefined : p.path} index={p.path === "/"} element={p.element} />
                  ))}
                </Route>
              </Routes>
            </Suspense>
          </ChatConversationAwareRuntime>
        </ComposedWrappers>
      </ShellAuth>
    </BrowserRouter>
  );
}

/**
 * Reads the current pathname (only meaningful inside ``<BrowserRouter>``),
 * matches it against any module-declared :type:`ChatConversationConfig`,
 * and hands the matched config + URL-extracted id down into
 * :type:`AGUIRuntimeProvider` as a :type:`AGUIHistoryAdapterFactory`.
 *
 * Why a factory (not a pre-built adapter)
 * =======================================
 * The history adapter needs *both* the URL-extracted conversation id
 * (when present) *and* the AG-UI adapter's freshly-minted thread id
 * (always set — covers fresh chats). The AG-UI adapter only exists
 * once :type:`AGUIRuntimeProvider` mounts, so the factory is invoked
 * inside that mount with both pieces available. This makes "fresh
 * chats also persist" a built-in property of the contract, not an
 * afterthought.
 */
function ChatConversationAwareRuntime({
  children,
  toolUIs,
  fetchFn,
  configs,
}: {
  children: ReactNode;
  toolUIs: ReactNode[];
  fetchFn: typeof fetch;
  configs: ChatConversationConfig[];
}) {
  const { pathname } = useLocation();

  // Pick the matching config (URL-pattern match) OR fall back to the
  // first config registered — modules without a URL match still want
  // their fresh-chat persistence. With ≥1 config the runtime always
  // gets a factory; without configs it stays in the legacy in-memory
  // mode.
  const { config, urlMatch } = useMemo(() => {
    for (const cfg of configs) {
      const m = pathname.match(cfg.pathPattern);
      if (m && m[1]) {
        return { config: cfg, urlMatch: m[1] };
      }
    }
    return { config: configs[0], urlMatch: undefined as string | undefined };
  }, [pathname, configs]);

  if (!config) {
    // No chatConversation configs registered → legacy in-memory
    // runtime, no history / no sticky concerns.
    return (
      <AGUIRuntimeProvider fetchFn={fetchFn}>
        {toolUIs}
        {children}
      </AGUIRuntimeProvider>
    );
  }

  // Per-config child component, KEYED by config identity. Why a
  // key/child split: ``config.useStickyConversationId`` is optional.
  // Calling it inline with the optional chain ``config?.useSticky?.()``
  // would be a Rules-of-Hooks violation the moment a second
  // ChatConversationConfig registers with different hook-shape — URL
  // navigation flips which cfg matches, the hook count flips, React
  // crashes. The key makes a config swap a full remount, which is a
  // legitimate way to change the hook lineage without violating the
  // rules. ``configIndex`` is stable per config because ``configs`` is
  // memoised in ShellApp.
  const configIndex = configs.indexOf(config);
  if (config.useStickyConversationId) {
    return (
      <StickyAwareRuntime
        key={`sticky:${configIndex}`}
        config={config}
        useSticky={config.useStickyConversationId}
        urlMatch={urlMatch}
        fetchFn={fetchFn}
        toolUIs={toolUIs}
      >
        {children}
      </StickyAwareRuntime>
    );
  }
  return (
    <UrlOnlyRuntime
      key={`url:${configIndex}`}
      config={config}
      urlMatch={urlMatch}
      fetchFn={fetchFn}
      toolUIs={toolUIs}
    >
      {children}
    </UrlOnlyRuntime>
  );
}

interface ChildRuntimeProps {
  config: ChatConversationConfig;
  urlMatch: string | undefined;
  fetchFn: typeof fetch;
  toolUIs: ReactNode[];
  children: ReactNode;
}

/**
 * Branch for configs that DECLARE :attr:`useStickyConversationId`.
 * Calls the hook unconditionally so React's hook-count invariant
 * holds across every render of this mount.
 */
function StickyAwareRuntime({
  config,
  useSticky,
  urlMatch,
  fetchFn,
  toolUIs,
  children,
}: ChildRuntimeProps & { useSticky: () => string | null }) {
  const sticky = useSticky();
  return (
    <RuntimeBody
      config={config}
      sticky={sticky}
      urlMatch={urlMatch}
      fetchFn={fetchFn}
      toolUIs={toolUIs}
    >
      {children}
    </RuntimeBody>
  );
}

/**
 * Branch for configs that DO NOT declare :attr:`useStickyConversationId`.
 * No hook is ever called for sticky state — the runtime threadId
 * follows URL match and the shell-minted fresh UUID only.
 */
function UrlOnlyRuntime({ config, urlMatch, fetchFn, toolUIs, children }: ChildRuntimeProps) {
  return (
    <RuntimeBody
      config={config}
      sticky={null}
      urlMatch={urlMatch}
      fetchFn={fetchFn}
      toolUIs={toolUIs}
    >
      {children}
    </RuntimeBody>
  );
}

/**
 * Shared rendering body — same useRef/useMemo/useCallback shape for
 * both branches. The hook lineage here is stable per mount because
 * the parent decides which branch (and which key) to use.
 */
function RuntimeBody({
  config,
  sticky,
  urlMatch,
  fetchFn,
  toolUIs,
  children,
}: ChildRuntimeProps & { sticky: string | null }) {
  // Pre-mint a fresh UUID so the runtime's ``threadId`` is set from
  // the very first render — never goes through ``undefined → defined``,
  // which would otherwise force a remount of the assistant-ui runtime
  // (and wipe in-flight messages) the moment the user sent their first
  // message on a fresh chat. The backend collapse (``conversation_id ==
  // agui_thread_id``) ensures the id the runtime uses from the start
  // matches the row the lazy ``ensureConversationId`` creates — same
  // value, no mid-conversation switch.
  //
  // Mint a new one only when the user actually starts a new thread:
  // ``sticky`` transitions from a value back to ``null`` (the module
  // clears it on the ``/`` "New Thread" landing).
  const freshIdRef = useRef<string>(_genUuid());
  const prevStickyRef = useRef<string | null>(sticky);
  if (sticky === null && prevStickyRef.current !== null) {
    // User just navigated back to "/" (New Thread). The previous chat
    // is being abandoned; mint a fresh UUID for the next session.
    freshIdRef.current = _genUuid();
  }
  prevStickyRef.current = sticky;

  // Effective id seen by AGUIRuntimeProvider — always defined.
  //   sticky (current conversation) wins, else fall back to the
  //   shell-minted UUID for fresh chats.
  const effectiveThreadId: string = sticky ?? urlMatch ?? freshIdRef.current;

  const historyAdapterFactory = useCallback<AGUIHistoryAdapterFactory>(
    (args: AGUIChatConversationFactoryArgs) =>
      config.buildHistoryAdapter({
        urlMatch: args.urlMatch,
        aguiThreadId: args.aguiThreadId,
      }),
    [config],
  );

  return (
    <AGUIRuntimeProvider
      fetchFn={fetchFn}
      threadId={effectiveThreadId}
      // ``urlMatch`` carries the URL-derived resume signal verbatim.
      // ``effectiveThreadId`` is always defined (sticky / urlMatch /
      // freshly minted UUID) so passing it in place of ``urlMatch``
      // would erase the "fresh vs resumed" distinction the history
      // adapter needs to decide whether to load() past messages.
      urlMatch={urlMatch}
      historyAdapterFactory={historyAdapterFactory}
    >
      {toolUIs}
      {children}
    </AGUIRuntimeProvider>
  );
}

function ToolUIGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * RFC 4122 v4 UUID. Use ``crypto.randomUUID`` when available; fall
 * back to a math-random shim for the rare environments without it
 * (older Safari on non-HTTPS dev hosts). The shim is fine for our
 * use — these UUIDs identify a conversation row in our backend; they
 * don't need cryptographic strength.
 */
function _genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
