# @iloveagents/foundry-agent

## 1.0.0

### Minor Changes

- 9105483: shell: ChatConversationConfig API + sticky-runtime threadId

  Lets a downstream module (e.g. `@ltwlf/spaces-web-ui`) attach a
  `ChatConversationConfig` to its `ChatModule`. The shell then:
  - Pre-mints a fresh thread UUID via `useRef` so the AG-UI runtime's
    `threadId` is defined from first render — no `undefined → defined`
    remount mid-conversation when the user sends the first message.
  - Calls `config.useStickyConversationId()` (when declared) and
    feeds the resulting id into the runtime so the chat stays "live"
    while the user browses non-chat routes (Workspaces, Jobs, etc.).
  - Per-config keyed child components (`StickyAwareRuntime` vs
    `UrlOnlyRuntime`) so optional hooks satisfy Rules-of-Hooks across
    multi-module config swaps.

  UI: collapsible nav groups in `sidebar.tsx` with persisted state via
  `useSyncExternalStore` + localStorage, plus stable group ordering via
  new `priority` field in `nav-config.ts`.

  `ag-ui-runtime-provider.tsx` accepts an external `threadId` and
  `historyAdapterFactory` so the consuming app can wire its own
  persistence (e.g. `ThreadHistoryAdapter` → REST `/api/conversations`).

### Patch Changes

- 2b10540: Fix `citationStore.clear()` so the registered handler survives per-conversation resets.

  The previous implementation wiped both `results` AND `handler`. `useNewConversation` calls `clear()` on every "New Thread" click. Combined with the `registerOnce`-style handler registration in feature modules (e.g. SPACES' `registerSpacesCitationHandler`), the result was that all `[n]` citation markers in chat became inert non-clickable spans for the rest of the session after the first new-thread click. `clear()` now resets `results` only — the handler is module-level state and must persist.

## 0.1.5

## 0.1.4

### Patch Changes

- 07ace7e: fix(agent): canonical MSAL.js recovery — acquireTokenRedirect-first, orphaned-state cleanup, dedup

  Closes the production "stuck on 401 forever" bug observed on a customer dev env after the 0.1.2 / 0.1.3 fixes. Diagnostic on the live tab showed `getAllAccounts() === []` despite localStorage holding 3 access tokens + 1 refresh token — the orphaned-state signature.

  **Root cause:** The previous recovery code did `setActiveAccount(null) + clearCache({account}) + loginRedirect()`. When `loginRedirect()` silently failed to navigate (caught by our try/catch — popup blocker, browser policy, async race), the account record was already gone but the tokens lingered. Every subsequent API call hit `getAllAccounts() === []` and silently returned `null` — no Bearer header, endless 401s, only manual `localStorage.clear()` recovered.

  **Canonical 2026 fix per Microsoft Learn `entra/msal/javascript/browser/errors`** + linked GitHub issues + msal-react samples:
  1. **`acquireTokenRedirect` first, not `loginRedirect`.** It's the documented primitive for refreshing a known account's tokens — preserves the account record across the navigation. `loginRedirect` is only the fallback when `acquireTokenRedirect` itself fails to navigate.
  2. **Never `clearCache` before redirect.** The redirect navigation IS the recovery signal; if it succeeds, MSAL handles state cleanup; if it fails, leave state intact for the next attempt rather than orphaning the cache.
  3. **Detect + repair orphaned state.** When `getAllAccounts() === []` but localStorage has MSAL token entries, nuke ALL `msal.*` keys (localStorage + sessionStorage) and force a fresh `loginRedirect`. Without this, the SPA renders authenticated UI but every API call goes anonymous.
  4. **Module-level recovery deduplication.** Multiple parallel API calls all hitting the recovery path simultaneously now share a single in-flight redirect promise instead of each issuing their own (which would cascade `interaction_in_progress` errors).

  The previous `recoverFromHardAuthFailure` callback now uses the same primitive — single recovery path for both "MSAL silent failed" and "API rejected refreshed token".

  68/68 agent tests pass (was 65) — the new tests assert the no-clearCache invariant, the acquireTokenRedirect-first ordering, the loginRedirect fallback path, and the orphaned-state nuke + redirect. Pair: lastspace bump to ^0.1.4.

## 0.1.3

### Patch Changes

- d9b0460: fix(agent): escalate to loginRedirect after second 401

  Follow-up to the auth-stale-token-401-retry fix in 0.1.2. The first version retried with `forceRefresh: true` and bounced to `loginRedirect` only when MSAL itself reported `InteractionRequiredAuthError`. But there's a more common production failure mode the silent path can't recover: the resource server rejects the **freshly-refreshed** token too — server-side policy drift, audience mismatch, conditional-access re-evaluation, claims challenge, tenant-policy change. MSAL has no way to know about any of this; it produces a clean refreshed token and calls it a day. The user is left in an endless silent 401 loop because nothing kicks them to `loginRedirect`.

  Adds `recoverFromHardAuthFailure(reason)` on `authStore`. The fetch interceptor calls it when a SECOND consecutive 401 fires (i.e. even the force-refresh retry didn't help). It clears the MSAL cache and starts `loginRedirect` so a brand-new session mints a token bound to current server policy.

  `createServiceFetch` now accepts an optional `recoverFromHardAuthFailure` callback. The default consumer (`@iloveagents/foundry-web-shell`) wires it to the new method on `authStore`. Same pattern in `tokenFetch`.

  Pair: `lastspace#TBD` (forwards the new option through `spacesFetch`).

## 0.1.2

### Patch Changes

- 30a4346: fix(agent): retry protected fetch with `forceRefresh` on 401

  Closes the long-lived-tab 401 loop where the only recovery the user had was logging out or clearing localStorage.

  The token-fetch wrapper used to ask MSAL for a cached token and never retry. If the resource server rejected that token (claims challenge, conditional-access re-eval, audience drift, or staleness MSAL's clock-offset check missed), every subsequent request kept re-sending the same token.

  Fix: on 401 from a protected API, retry once with `acquireTokenSilent({ forceRefresh: true })`. If that also fails, the existing `InteractionRequiredAuthError` path bounces the user through Entra ID. Single-retry cap so we never loop. Request bodies are cloned per-attempt (ReadableStream is single-consume) so POST/PUT payloads survive the retry intact.

  The `acquireToken` callback type now accepts an optional `{ forceRefresh? }` argument — non-breaking; existing callbacks continue to work, but they should forward the option to their token source so the retry path actually reaches the auth backend.

  Pair: `lastspace#205` (forwards the option through `spacesFetch.acquireToken`).

## 0.1.1

### Patch Changes

- 689d3e9: feat(sidebar): distinct file-drop affordance for nav containers

  `useNavItemDnd` now exposes `isFileDragOver` separately from `isDragOver`
  so consuming nav items can render a prominent file-drop visual (dashed
  primary outline + soft primary background + Upload icon) when the user
  is dragging native files over the container. Previously file drags
  shared the same subtle ring as entity-move drags, so users couldn't
  tell that a folder accepted external files. Applies to all five nav-
  item shapes (action-row leaf, button leaf, `NestedFolderItem`,
  `CollapsibleNavItem` with children/actions, `NavLink` fallthrough) and
  updates `ContainerDropZone` for visual parity.

  Also fixes a related regression: the capture-phase
  `onDragEnterCapture` / `onDragOverCapture` handlers were calling
  `e.stopPropagation()`, which short-circuits React's synthetic dispatch
  and prevented the bubble-phase `onDragEnter` (where state actually
  mutates) from running. Removed — `preventDefault()` alone is enough to
  mark the element as droppable.
