Pure-TS agent transport for the LYKOMI UI open-core stack. Published as `@lykomi/agent`. Zero DOM, zero React, zero `@assistant-ui/*`. Cross-runtime — consumed by `@lykomi/web-ui` today, future Outlook / Teams / native shells tomorrow.

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
    link-store.ts              ← vanilla zustand store (link handling)
  tools/
    registry.ts       ← clientToolRegistry (vanilla zustand store).
  msal/               ← subpath export: @lykomi/agent/msal
    auth-store.ts     ← authStore (vanilla zustand store)
    auth-config.ts    ← MsalAuthConfig + initializeMsal singleton.
    token-fetch.ts    ← Bearer-token-attaching fetch.
    index.ts          ← barrel for the /msal subpath
  index.ts            ← barrel for the root export.
  __tests__/          ← vitest suite (runner, service-fetch, stores, registry, msal auth/token).
```

# Import boundary (enforced by guard test)

Files under `packages/agent/src/` (excluding `msal/`) MUST NOT import:

- `react`, `react-dom`
- `@assistant-ui/*` (anywhere — including under `msal/`)
- `@azure/msal-*` (anywhere — including under `msal/` for `msal-react`; only `@azure/msal-browser` is allowed under `msal/`)
- bare `"zustand"` — use `"zustand/vanilla"` (`zustand/middleware` is allowed)

Files under `packages/agent/src/msal/` MAY import `@azure/msal-browser` (dynamic import only — keeps the dep optional). They MUST NOT import `@azure/msal-react` (which is React-bound and lives in `@lykomi/web-ui`).

`packages/agent/` MUST NOT import from any other `@lykomi/*` package — agent is the leaf of the open-core graph. (No package here may import commercial downstream packages — `@ltwlf/*` — either.)

# Why `zustand/vanilla`

`import { create } from "zustand"` resolves to the React build (`useSyncExternalStore`). Importing it in a "zero React" package would silently take a React dependency and defeat the cross-runtime goal. Every store in this package uses `import { createStore } from "zustand/vanilla"`. React consumers (in `@lykomi/web-ui` / `apps/web/`) bind via `useStore(store, selector)` from the React entry of zustand.

# What goes here

- AG-UI protocol client (SSE, message conversion, multi-turn re-issue, tool dispatch).
- Vanilla state stores that the protocol engine needs at runtime — streaming status, citation cache, client-tool registry.
- MSAL bits under the `/msal` subpath only.
- Generic per-service fetch factory (`createServiceFetch`).

# Multi-turn replay contract (read before touching `agui-runner.ts`)

`HttpAgent` (from `@ag-ui/client`) is not a dumb transport: `AbstractAgent.processApplyEvents` applies the streamed events to **its own** `messages` array, so once a run finishes the client has already recorded the assistant message including its tool calls. The follow-up may therefore only add what is _missing_ — the tool results, plus an assistant message only for tool calls the client did not record.

Appending an unconditional copy is what shipped before: the follow-up carried the same `toolCallId` twice against a single tool result, the model treated the call as unanswered, re-issued the tool (a duplicate card in the UI) and then told the user it "didn't complete" — while the tool had in fact succeeded.

Any test here must have its mock emulate that accumulation (push the assistant message onto `agent.messages` during the scripted run). The original mock did not, which is why a fully green suite missed the bug; `agui-runner.test.ts` now covers it.

# Protocol coverage

The runner subscribes to **every** AG-UI event type. Canonical events get a
dedicated `AgentSubscriber` callback; the chunked and legacy variants
(`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`, `THINKING_*`) need none, because
`@ag-ui/client` normalizes them onto the canonical events (`transformChunks`
and the backward-compatibility middleware) before the subscriber runs.

Coverage was audited once at 11 of 33 types, and the gaps were not harmless:
reasoning text was being discarded, long runs showed one opaque "thinking"
state because step names never arrived, and server-published state never
reached React. When adding a protocol event, emit a `RunnerEvent` for it even
if nothing renders it yet — a `default:` that silently drops is how those gaps
survived. The adapter's switch is exhaustive for the same reason.

# What does NOT go here

- Anything implementing `@assistant-ui/*` interfaces (`ChatModelAdapter`, `AttachmentAdapter`, etc.) — those are React UI surface and live in `@lykomi/web-ui`.
- React components, hooks, contexts, providers.
- UI-layout state (panel widths, modal modes, theme).
- The `MsalProvider` React component — that lives in `@lykomi/web-ui`.

# Public surface

Root `@lykomi/agent`:

```ts
import {
  AGUIRunner,
  type AGUIRunnerOptions,
  type AGUIRunInput,
  type RunnerEvent,
  createServiceFetch,
  type ServiceFetch,
  type ServiceFetchOptions,
  clientToolRegistry,
  type ClientToolEntry,
  type ToolRegistry,
  streamingStatusStore,
  type StreamingStatus,
  citationStore,
  type CitationResult,
  type CitationHandler,
  linkStore,
  resolveLinkHandler,
  type LinkHandler,
  type ResolvedLinkHandler,
} from "@lykomi/agent";
```

Subpath `@lykomi/agent/msal`:

```ts
import {
  authStore,
  AuthInteractionRequiredError,
  type AuthUser,
  type MsalAuthConfig,
  type MsalAccountInfo,
  type MsalClientApplication,
  initializeMsal,
  getMsalInstance,
  getMsalConfig,
  tokenFetch,
} from "@lykomi/agent/msal";
```

# Bundle-size budget

Target ≤25 KB gz on the root entry (`@lykomi/agent`, excluding the `/msal` subpath). Measured manually pre-1.0 via `gzip -c dist/index.js | wc -c`; `size-limit` enforcement is planned but not yet scaffolded.
