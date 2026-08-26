import type { ComponentType, ReactNode } from "react";
import type { ThemeLayer } from "@iloveagents/foundry-web-ui";

/**
 * Per-mount inputs the shell hands the module's history-adapter
 * factory. Either ``urlMatch`` (resumed chat — the user clicked a
 * Recents entry) or ``aguiThreadId`` alone (fresh chat — assistant-ui
 * just minted a UUID) drives the canonical conversation id, depending
 * on what the module's backend treats as authoritative.
 */
export interface ChatConversationFactoryArgs {
  /**
   * The conversation id captured from the URL via
   * :attr:`ChatConversationConfig.pathPattern`. Set when the user
   * resumed a known chat; ``undefined`` on a fresh thread.
   */
  urlMatch?: string;
  /**
   * The assistant-ui adapter's stable thread id (a client-minted
   * UUID, unique per "New Thread" click). Always set. Use this as the
   * key for a lazy ``create_or_get`` when ``urlMatch`` is missing so
   * fresh chats also persist.
   */
  aguiThreadId: string;
}

/**
 * URL-driven chat persistence wiring. Modules declare this so the
 * shell can stand up an assistant-ui :type:`ThreadHistoryAdapter` on
 * every mount of :type:`AGUIRuntimeProvider` — both resumed chats
 * (matched URL) and fresh chats.
 *
 * The shell stays free of feature-specific knowledge: it captures
 * the URL match (if any) and the assistant-ui-minted thread id, and
 * hands both to :attr:`buildHistoryAdapter`. The module owns the
 * actual backend API shape and "fresh chat vs. resume" semantics.
 */
export interface ChatConversationConfig {
  /**
   * Regex with exactly one capture group that yields the conversation
   * id from ``window.location.pathname``. Example:
   * ``/^\/chat\/([^/]+)$/``.
   */
  pathPattern: RegExp;
  /**
   * Optional hook giving the module's view of "what conversation is
   * the user currently engaged with" — separate from the URL.
   *
   * Why this exists: ChatGPT-style UX wants the chat runtime to stay
   * alive while the user browses Workspaces, Jobs, etc. If we drove
   * the runtime's ``threadId`` from the URL only, every non-chat
   * navigation would remount the runtime and wipe in-flight messages.
   *
   * When provided, the shell prefers this value over the URL match
   * for the ``AGUIRuntimeProvider.threadId`` prop. The module is
   * expected to update its sticky state on URL transitions itself
   * (e.g. via :type:`useTrackActiveChatFromUrl` in Spaces).
   *
   * Return ``null`` when the user has no active chat (initial app
   * load, or just clicked "New Thread"). The shell then lets the
   * AG-UI adapter mint a fresh UUID, same as before this hook.
   */
  useStickyConversationId?: () => string | null;
  /**
   * Build an assistant-ui :type:`ThreadHistoryAdapter` for the
   * current mount. Called inside the runtime provider once the
   * AG-UI adapter has minted (or accepted) its thread id, so both
   * ``urlMatch`` and ``aguiThreadId`` are available.
   *
   * The returned adapter is wired into ``useLocalRuntime``'s
   * ``adapters.history`` slot — assistant-ui calls ``load()`` on
   * mount and ``append()`` after every completed turn.
   *
   * Modules typically:
   *   - On resume (``urlMatch`` set): use it directly as the
   *     conversation id for load/append.
   *   - On fresh (``urlMatch`` undefined): lazily ``create_or_get``
   *     a server row keyed by ``aguiThreadId``, cache the resulting
   *     conversation id, then load/append against that.
   */
  buildHistoryAdapter: (
    args: ChatConversationFactoryArgs,
  ) => import("@assistant-ui/react").ThreadHistoryAdapter;
}

/** Route entry contributed by a module or the host app. */
export interface ShellPage {
  path: string;
  element: ReactNode;
}

/**
 * A ChatModule is the unit of composition for `bootstrapShell`. Each field is
 * optional — modules contribute what they need:
 *
 * - `useInit`: React hook body called once per layout render (rules-of-hooks
 *   apply). Use for cross-store sync, registry registration, etc.
 *   Modules wanting to mutate `useNavStore` config (sidebar nav items)
 *   do it inside `useInit` — see Spaces' `useSpacesNavSync()` for the
 *   canonical pattern.
 * - `toolUIs`: ReactNode rendered inside `<AGUIRuntimeProvider>`. Use to
 *   register `makeAssistantToolUI` instances.
 * - `layoutExtras`: ReactNode rendered inside the shell layout (banners,
 *   global dialogs, popovers).
 * - `wrappers`: ComponentType<{children}>[] applied outer→inner from the
 *   array. Wrap providers like SpacesQueryProvider here.
 * - `useThemeLayers`: hook returning ThemeLayer[]; merged on top of the
 *   static `theme` prop in module-array order.
 * - `pages`: ShellPage[] appended to Routes; customer-supplied `pages` win
 *   on path collision.
 * - `fetchInterceptor`: zero-arg installer called once before `createRoot`.
 *   Use to install `window.fetch` wrappers.
 */
export interface ChatModule {
  name: string;
  useInit?: () => void;
  toolUIs?: ReactNode;
  layoutExtras?: ReactNode;
  wrappers?: ComponentType<{ children: ReactNode }>[];
  useThemeLayers?: () => ThemeLayer[];
  pages?: ShellPage[];
  fetchInterceptor?: () => void;
  /**
   * URL-driven chat persistence.
   *
   * Selection order (see ``ChatConversationAwareRuntime`` in
   * ``shell-app.tsx``):
   *
   * 1. URL match. If a module's ``pathPattern`` matches the current
   *    pathname and captures a non-empty group, that module's config
   *    wins and its captured id is fed to the history adapter as
   *    ``urlMatch``.
   * 2. Fallback. If nothing matches the URL, the shell falls back to
   *    the FIRST registered config (``configs[0]``) so a fresh-chat
   *    runtime still gets a history adapter and the chat persists
   *    from the very first message. ``urlMatch`` is ``undefined``
   *    in this case.
   * 3. None. With zero configs registered, the runtime stays in
   *    legacy in-memory mode (no persistence).
   *
   * Modules without a config don't participate in selection.
   */
  chatConversation?: ChatConversationConfig;
}

/**
 * Adapter for plugging in an auth Provider. The Provider renders children
 * once authenticated and is responsible for resolving its own config
 * (the default reads MSAL settings from `import.meta.env`). Tests and
 * non-MSAL deployments override with a different Provider.
 */
export interface AuthAdapter {
  Provider: ComponentType<{ children: ReactNode }>;
}

export interface BootstrapShellOptions {
  modules?: ChatModule[];
  /** Customer-supplied pages — win over module pages on `path` collision. */
  pages?: ShellPage[];
  /** Static base theme layers; modules' useThemeLayers stack on top. */
  theme?: ThemeLayer[];
  /** Override default MSAL-backed auth provider (e.g. for tests). */
  authProvider?: AuthAdapter;
  /**
   * Override the agent transport used by the AG-UI runtime.
   *
   * Defaults to the MSAL-backed `defaultAgentFetch`. Apps can pass a custom
   * fetch to point at a local demo agent, a mock AG-UI transport, or a
   * production backend without patching global `window.fetch`.
   */
  agentFetch?: typeof fetch;
  /** Wrap the tree in <StrictMode>. Default: true. */
  strictMode?: boolean;
  /** DOM element to mount into. Default: document.getElementById("root"). */
  rootElement?: HTMLElement;
}

/** Pass-through helper that adds nothing at runtime — pure type marker. */
export function defineChatModule(m: ChatModule): ChatModule {
  return m;
}
