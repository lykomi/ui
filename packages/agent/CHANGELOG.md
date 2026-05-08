# @iloveagents/foundry-agent

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
