---
"@iloveagents/foundry-agent": patch
---

fix(agent): escalate to loginRedirect after second 401

Follow-up to the auth-stale-token-401-retry fix in 0.1.2. The first version retried with `forceRefresh: true` and bounced to `loginRedirect` only when MSAL itself reported `InteractionRequiredAuthError`. But there's a more common production failure mode the silent path can't recover: the resource server rejects the **freshly-refreshed** token too — server-side policy drift, audience mismatch, conditional-access re-evaluation, claims challenge, tenant-policy change. MSAL has no way to know about any of this; it produces a clean refreshed token and calls it a day. The user is left in an endless silent 401 loop because nothing kicks them to `loginRedirect`.

Adds `recoverFromHardAuthFailure(reason)` on `authStore`. The fetch interceptor calls it when a SECOND consecutive 401 fires (i.e. even the force-refresh retry didn't help). It clears the MSAL cache and starts `loginRedirect` so a brand-new session mints a token bound to current server policy.

`createServiceFetch` now accepts an optional `recoverFromHardAuthFailure` callback. The default consumer (`@iloveagents/foundry-web-shell`) wires it to the new method on `authStore`. Same pattern in `tokenFetch`.

Pair: `lastspace#TBD` (forwards the new option through `spacesFetch`).
