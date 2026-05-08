---
"@iloveagents/foundry-agent": patch
---

fix(agent): retry protected fetch with `forceRefresh` on 401

Closes the long-lived-tab 401 loop where the only recovery the user had was logging out or clearing localStorage.

The token-fetch wrapper used to ask MSAL for a cached token and never retry. If the resource server rejected that token (claims challenge, conditional-access re-eval, audience drift, or staleness MSAL's clock-offset check missed), every subsequent request kept re-sending the same token.

Fix: on 401 from a protected API, retry once with `acquireTokenSilent({ forceRefresh: true })`. If that also fails, the existing `InteractionRequiredAuthError` path bounces the user through Entra ID. Single-retry cap so we never loop. Request bodies are cloned per-attempt (ReadableStream is single-consume) so POST/PUT payloads survive the retry intact.

The `acquireToken` callback type now accepts an optional `{ forceRefresh? }` argument — non-breaking; existing callbacks continue to work, but they should forward the option to their token source so the retry path actually reaches the auth backend.

Pair: `lastspace#205` (forwards the option through `spacesFetch.acquireToken`).
