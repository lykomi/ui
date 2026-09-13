import { useFreshConversationId } from "./use-fresh-conversation-id.ts";
import { type ReactNode, Suspense, useCallback, useEffect, useMemo } from "react";
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
import { _setChatConfigFetch, loadChatConfig } from "./load-chat-config.ts";

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

/**
 * Loads the chat config once, from INSIDE the authenticated subtree.
 *
 * This must not run in `ShellApp`'s own body: `ShellAuth` is its CHILD, so
 * an effect there fires before sign-in completes. The agent fetch would
 * then 401, exhaust its refresh retry, and call
 * `recoverFromHardAuthFailure` -> `loginRedirect` -> remount -> repeat: an
 * infinite login loop on any session that isn't already cached. Rendering
 * the load here means there is a token by the time it runs.
 */
function ChatConfigBoot({ fetchImpl }: { fetchImpl: typeof fetch }) {
  useEffect(() => {
    void loadChatConfig(fetchImpl);
  }, [fetchImpl]);
  return null;
}

export function ShellApp({
  modules,
  pages,
  baseThemeLayers,
  authProvider,
  agentFetch,
}: ShellAppProps) {
  const resolvedAgentFetch = agentFetch ?? defaultAgentFetch;
  // Bind the refresh seam here (cheap, no I/O) so a host-app context
  // refresh that races boot uses the same fetch client. The actual load
  // happens in <ChatConfigBoot> INSIDE ShellAuth — see the note there.
  useEffect(() => {
    _setChatConfigFetch(resolvedAgentFetch);
  }, [resolvedAgentFetch]);

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
        <ChatConfigBoot fetchImpl={resolvedAgentFetch} />
        <ComposedWrappers wrappers={wrappers}>
          <ChatConversationAwareRuntime
            fetchFn={fetchFn}
            configs={chatConversationConfigs}
            toolUIs={toolUIs}
          >
            <Suspense fallback={null}>
              <Routes>
                <Route
                  element={<ShellLayout modules={modules} baseThemeLayers={baseThemeLayers} />}
                >
                  {mergedPages.map((p) => (
                    <Route
                      key={p.path}
                      path={p.path === "/" ? undefined : p.path}
                      index={p.path === "/"}
                      element={p.element}
                    />
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
  const freshId = useFreshConversationId(sticky);

  // Effective id seen by AGUIRuntimeProvider — always defined.
  //
  // Priority order matters and is intentional:
  //   1. ``urlMatch`` — when the user is on ``/chat/<id>`` the URL is
  //      ALWAYS the authoritative conversation. This MUST come before
  //      ``sticky`` because of a stale-render race on cross-chat
  //      navigation:
  //        - User is on ``/chat/A``. ``active-chat-store`` holds ``A``.
  //          So ``sticky = A``.
  //        - User clicks a Recents row for ``B`` →
  //          ``react-router`` updates pathname to ``/chat/B``.
  //        - On the synchronous render that follows, ``urlMatch`` is
  //          ``B`` (read from ``useLocation``) but
  //          ``useTrackActiveChatFromUrl``'s ``useEffect`` hasn't run
  //          yet — so ``sticky`` is still ``A``.
  //        - With ``sticky ?? urlMatch`` we'd compute
  //          ``effectiveThreadId = A``, bind the AG-UI adapter to ``A``,
  //          and the first message the user sends would create a NEW
  //          row at ``A``'s old thread id while the URL says ``B``.
  //          Symptoms: TWO active dots in the sidebar (URL highlights
  //          row ``B``, the new row's id activates the dot on a
  //          freshly-appeared "Untitled chat"); resume appears to
  //          mint a new conversation; messages land on the wrong row.
  //      Putting ``urlMatch`` first eliminates the race entirely: when
  //      the URL says we're on chat ``B``, the runtime targets ``B``
  //      from the very first render, regardless of stale store state.
  //   2. ``sticky`` — for non-chat URLs (``/spaces``, ``/tasks`` …)
  //      ``urlMatch`` is ``undefined``. ``sticky`` keeps the popout
  //      chat "live" while the user browses elsewhere.
  //   3. ``freshId`` — brand-new chat on ``/`` with no
  //      sticky and no URL match. Pre-minted so the runtime's
  //      ``threadId`` is defined from the first render (no
  //      ``undefined → defined`` remount of assistant-ui).
  const effectiveThreadId: string = urlMatch ?? sticky ?? freshId;

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
