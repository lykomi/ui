---
"@iloveagents/foundry-agent": patch
---

fix(agent): canonical MSAL.js recovery — acquireTokenRedirect-first, orphaned-state cleanup, dedup

Closes the production "stuck on 401 forever" bug observed on a customer dev env after the 0.1.2 / 0.1.3 fixes. Diagnostic on the live tab showed `getAllAccounts() === []` despite localStorage holding 3 access tokens + 1 refresh token — the orphaned-state signature.

**Root cause:** The previous recovery code did `setActiveAccount(null) + clearCache({account}) + loginRedirect()`. When `loginRedirect()` silently failed to navigate (caught by our try/catch — popup blocker, browser policy, async race), the account record was already gone but the tokens lingered. Every subsequent API call hit `getAllAccounts() === []` and silently returned `null` — no Bearer header, endless 401s, only manual `localStorage.clear()` recovered.

**Canonical 2026 fix per Microsoft Learn `entra/msal/javascript/browser/errors`** + linked GitHub issues + msal-react samples:

1. **`acquireTokenRedirect` first, not `loginRedirect`.** It's the documented primitive for refreshing a known account's tokens — preserves the account record across the navigation. `loginRedirect` is only the fallback when `acquireTokenRedirect` itself fails to navigate.

2. **Never `clearCache` before redirect.** The redirect navigation IS the recovery signal; if it succeeds, MSAL handles state cleanup; if it fails, leave state intact for the next attempt rather than orphaning the cache.

3. **Detect + repair orphaned state.** When `getAllAccounts() === []` but localStorage has MSAL token entries, nuke ALL `msal.*` keys (localStorage + sessionStorage) and force a fresh `loginRedirect`. Without this, the SPA renders authenticated UI but every API call goes anonymous.

4. **Module-level recovery deduplication.** Multiple parallel API calls all hitting the recovery path simultaneously now share a single in-flight redirect promise instead of each issuing their own (which would cascade `interaction_in_progress` errors).

The previous `recoverFromHardAuthFailure` callback now uses the same primitive — single recovery path for both "MSAL silent failed" and "API rejected refreshed token".

68/68 agent tests pass (was 65) — the new tests assert the no-clearCache invariant, the acquireTokenRedirect-first ordering, the loginRedirect fallback path, and the orphaned-state nuke + redirect. Pair: lastspace bump to ^0.1.4.
