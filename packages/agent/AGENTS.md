Pure-TS agent transport for the LastSpace open-core stack. Published as `@lastspace/agent`. Zero DOM, zero React, zero `@assistant-ui/*`. Cross-runtime — consumed by `@lastspace/web-ui` today, future Outlook / Teams / native shells tomorrow.

# Architecture

```
src/
  client/
    agui-runner.ts    ← AG-UI protocol engine (SSE + multi-turn loop). Yields RunnerEvent.
    runner-events.ts  ← RunnerEvent discriminated union.
    service-fetch.ts  ← createServiceFetch({ acquireToken, baseUrl }) factory.
  store/
    streaming-status-store.ts  ← vanilla zustand store
    citation-store.ts          ← vanilla zustand store
  tools/
    registry.ts       ← clientToolRegistry (vanilla zustand store).
  msal/               ← subpath export: @lastspace/agent/msal
    auth-store.ts     ← authStore (vanilla zustand store)
    auth-config.ts    ← MsalAuthConfig + initializeMsal singleton.
    token-fetch.ts    ← Bearer-token-attaching fetch.
    index.ts          ← barrel for the /msal subpath
  index.ts            ← barrel for the root export.
  __tests__/          ← vitest suite (runner, service-fetch, no-react smoke).
```

# Import boundary (enforced by guard test)

Files under `packages/agent/src/` (excluding `msal/`) MUST NOT import:

- `react`, `react-dom`
- `@assistant-ui/*` (anywhere — including under `msal/`)
- `@azure/msal-*` (anywhere — including under `msal/` for `msal-react`; only `@azure/msal-browser` is allowed under `msal/`)
- bare `"zustand"` — use `"zustand/vanilla"` (`zustand/middleware` is allowed)

Files under `packages/agent/src/msal/` MAY import `@azure/msal-browser` (dynamic import only — keeps the dep optional). They MUST NOT import `@azure/msal-react` (which is React-bound and lives in `@lastspace/web-ui`).

`packages/agent/` MUST NOT import from any other `@lastspace/*` package — agent is the leaf of the open-core graph.

# Why `zustand/vanilla`

`import { create } from "zustand"` resolves to the React build (`useSyncExternalStore`). Importing it in a "zero React" package would silently take a React dependency and defeat the cross-runtime goal. Every store in this package uses `import { createStore } from "zustand/vanilla"`. React consumers (in `@lastspace/web-ui` / `apps/web/`) bind via `useStore(store, selector)` from the React entry of zustand.

# What goes here

- AG-UI protocol client (SSE, message conversion, multi-turn re-issue, tool dispatch).
- Vanilla state stores that the protocol engine needs at runtime — streaming status, citation cache, client-tool registry.
- MSAL bits under the `/msal` subpath only.
- Generic per-service fetch factory (`createServiceFetch`).

# What does NOT go here

- Anything implementing `@assistant-ui/*` interfaces (`ChatModelAdapter`, `AttachmentAdapter`, etc.) — those are React UI surface and live in `@lastspace/web-ui`.
- React components, hooks, contexts, providers.
- UI-layout state (panel widths, modal modes, theme).
- The `MsalProvider` React component — that lives in `@lastspace/web-ui`.

# Public surface

Root `@lastspace/agent`:

```ts
import {
  AGUIRunner,
  type RunnerEvent,
  createServiceFetch,
  clientToolRegistry,
  type ClientToolEntry,
  streamingStatusStore,
  type StreamingStatus,
  citationStore,
  type CitationResult,
  type CitationHandler,
} from "@lastspace/agent";
```

Subpath `@lastspace/agent/msal`:

```ts
import {
  authStore,
  type AuthUser,
  type MsalAuthConfig,
  initializeMsal,
  getMsalInstance,
  getMsalConfig,
  tokenFetch,
} from "@lastspace/agent/msal";
```

# Bundle-size budget

Target ≤25 KB gz on the root entry (`@lastspace/agent`, excluding the `/msal` subpath). Measured manually pre-1.0 via `gzip -c dist/index.js | wc -c`; `size-limit` enforcement scaffolds in #92's follow-up.
