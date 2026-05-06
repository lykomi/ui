import type { ComponentType, ReactNode } from "react";
import type { ThemeLayer } from "@iloveagents/foundry-web-ui";

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
  /** Wrap the tree in <StrictMode>. Default: true. */
  strictMode?: boolean;
  /** DOM element to mount into. Default: document.getElementById("root"). */
  rootElement?: HTMLElement;
}

/** Pass-through helper that adds nothing at runtime — pure type marker. */
export function defineChatModule(m: ChatModule): ChatModule {
  return m;
}
