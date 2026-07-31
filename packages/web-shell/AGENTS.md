Browser bootstrap for Foundry UI agent apps. Published as `@iloveagents/foundry-web-shell`. Composes `@iloveagents/foundry-web-primitives`, `@iloveagents/foundry-agent` (and `@iloveagents/foundry-agent/msal`), and `@iloveagents/foundry-web-ui` into a generic mounting point — customers and modules contribute pages, theme layers, layout extras, tool UIs, and per-request fetch interceptors via the `ChatModule` protocol.

# Architecture

Publishes built ESM JavaScript plus `.d.ts` declarations from `dist/`, same convention as the other `@iloveagents/foundry-*` runtime packages.

```
src/
  index.ts                 ← public barrel (bootstrapShell, ChatModule, defineChatModule, types)
  bootstrap-shell.tsx      ← entry point: installs fetch interceptors, calls createRoot
  shell-app.tsx            ← <BrowserRouter> → AuthProvider → [wrappers outer→inner] → AGUIRuntimeProvider → {toolUIs} → Suspense → Routes
  shell-layout.tsx         ← generic layout (Sidebar + ChatHeader + ToolPanelLayout + ChatBubble + GlobalSelectionPopover + module layoutExtras)
  types.ts                 ← ChatModule, ChatConversationConfig, ShellPage, AuthAdapter, BootstrapShellOptions
  auth-default.tsx         ← default authProvider (wraps @iloveagents/foundry-web-ui's AuthProvider; reads MsalAuthConfig from import.meta.env)
  service-fetch-default.ts ← default fetchFn (createServiceFetch + tokenFetch wiring)
  runtime-config.ts        ← runtime config resolution helpers
  use-page-panel-width.ts  ← drag-to-resize chat/content split (persisted)
```

# Public API

```ts
import { bootstrapShell, defineChatModule, type ChatModule } from "@iloveagents/foundry-web-shell";
```

`bootstrapShell({ modules, pages, theme, authProvider, agentFetch, strictMode, rootElement })` mounts the SPA — `agentFetch` overrides the MSAL-backed default agent transport (local demo agents, mocks, custom backends), `rootElement` overrides the mount node. Each `ChatModule` may contribute:

- `useInit?: () => void` — React hook body called inside the layout (rules-of-hooks apply).
- `toolUIs?: ReactNode` — rendered inside `<AGUIRuntimeProvider>`.
- `layoutExtras?: ReactNode` — rendered inside the layout (banners, dialogs, popovers).
- `wrappers?: ComponentType<{ children }>[]` — applied outer→inner from array.
- `useThemeLayers?: () => ThemeLayer[]` — hook returning theme layers; merged on top of static `theme` prop.
- `pages?: { path; element }[]` — appended to Routes; customer `pages` win on path collision. (Sidebar nav items are mutated via `useNavStore.getState().setConfig(...)` inside `useInit` — see Spaces' `useSpacesNavSync` for the pattern.)
- `fetchInterceptor?: () => void` — installed before `createRoot` (use to install global fetch wrappers).
- `chatConversation?: ChatConversationConfig` — URL-driven chat persistence: `pathPattern` (regex capturing the conversation id), optional `useStickyConversationId()` (keeps the chat runtime alive across non-chat navigation), and `buildHistoryAdapter({ urlMatch, aguiThreadId })` returning an assistant-ui `ThreadHistoryAdapter`. Selection order: URL match → first registered config (fresh chats persist too) → none (legacy in-memory mode). Full contract: `src/types.ts`.

# Wrapper ordering

```
<StrictMode>
  <BrowserRouter>
    <AuthProvider>
      {wrappers outer→inner from modules}
        <AGUIRuntimeProvider>
          {toolUIs}
          <Suspense>
            <Routes>
              <Route element={<ShellLayout />}>
                {pages — customer wins on path collision}
              </Route>
            </Routes>
          </Suspense>
        </AGUIRuntimeProvider>
      {/wrappers}
    </AuthProvider>
  </BrowserRouter>
</StrictMode>
```

Asserted by `src/__tests__/wrapper-order.test.tsx`.

# Import boundary (enforced by guard test)

`@iloveagents/foundry-web-shell` MAY import: `@iloveagents/foundry-web-primitives`, `@iloveagents/foundry-web-ui`, `@iloveagents/foundry-agent` (+ subpaths). MUST NOT import `@ltwlf/spaces-web-ui` (or any commercial downstream package) — modules are runtime parameters, never compile-time deps. Enforced by `OPEN_CORE_GRAPH` in `packages/web-ui/src/__tests__/open-core-guards.test.ts`.

`packages/web-shell/src/` MUST stay ≤ 15 files (file-count ceiling, hardFail).

# Theme

`bootstrapShell({ theme })` provides static base layers. Modules' `useThemeLayers()` hooks return additional layers stacked on top in module-array order. Final layers feed `<ThemeRuntimeProvider layers={...}>`.

# Auth

The default `authProvider` reads `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_API_SCOPE` from `import.meta.env`. Missing keys render the `AuthConfigError` UI. Customers can override with `authProvider={{ Provider: MyAuthProvider }}` for testing or non-MSAL deployments.

# Commands

```bash
pnpm --filter @iloveagents/foundry-web-shell test:unit   # vitest run
pnpm --filter @iloveagents/foundry-web-shell typecheck   # tsc --noEmit
```

# Authoring a module

The `ChatModule` protocol is documented in **Public API** above; the canonical type definitions live in [`src/types.ts`](src/types.ts) (`ChatModule`, `defineChatModule`). For the nav-mutation-from-`useInit` pattern, have your module's `useInit` write the sidebar nav `config` into `useNavStore` (the same store [`src/shell-layout.tsx`](src/shell-layout.tsx) reads via `useNavStore((s) => s.config)`).
