import { createStore } from "zustand/vanilla";
import { getMsalInstance, getMsalConfig } from "./auth-config.ts";
import type { MsalAccountInfo, MsalClientApplication } from "./auth-config.ts";

export interface AuthUser {
  name: string;
  email: string;
  avatar?: string;
  oid?: string;
}

export class AuthInteractionRequiredError extends Error {
  readonly code?: string;
  readonly cause?: unknown;

  constructor(message: string, options: { code?: string; cause?: unknown } = {}) {
    super(message);
    this.name = "AuthInteractionRequiredError";
    this.code = options.code;
    this.cause = options.cause;
  }
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;

  /** Sign in with the given user. Called by AuthProvider after MSAL login. */
  signIn: (user: AuthUser) => void;

  /** Sign out and clear user state. Triggers MSAL logout when configured. */
  signOut: () => void;

  /**
   * Acquire an access token for the given audience.
   * Returns null when MSAL is not configured (local dev).
   *
   * Recovery semantics — follows the canonical MSAL.js pattern documented
   * at https://learn.microsoft.com/entra/msal/javascript/browser/errors:
   *
   * 1. ``acquireTokenSilent`` first. Pass-through on success.
   * 2. On a recoverable error (``InteractionRequiredAuthError``,
   *    ``monitor_window_timeout`` from blocked silent-SSO iframes,
   *    ``login_required`` / ``consent_required``), call
   *    :func:`startInteractiveRecovery` to navigate the user through a
   *    fresh interactive auth.
   *
   * Recovery uses ``acquireTokenRedirect`` (NOT ``loginRedirect``) as
   * the first step — that's the documented primitive for refreshing a
   * known account's tokens without forcing a full re-login. Falls back
   * to ``loginRedirect`` only when ``acquireTokenRedirect`` itself
   * fails to navigate (browser policy, popup blocker, etc.).
   *
   * Critically: cache is NEVER cleared before the redirect. The
   * previous version cleared the account record before calling
   * ``loginRedirect``; when the redirect failed silently (browser
   * blocking the navigation), the account record was gone but the
   * tokens lingered, leaving every subsequent API call to find
   * ``getAllAccounts() === []``, return null, and ship anonymously
   * to the API — endless 401s, only manual ``localStorage.clear()``
   * recovers. This bug is documented in
   * AzureAD/microsoft-authentication-library-for-js#7551.
   *
   * Recoverable auth failures reject with ``AuthInteractionRequiredError``
   * after recovery has been started. The error exposes ``code`` and
   * ``cause`` so callers can distinguish a normal interaction-required
   * redirect from a blocked/failed redirect attempt.
   *
   * Other ``BrowserAuthError`` codes (``hash_empty_error``,
   * ``hash_does_not_contain_known_properties``, ``block_iframe_reload``)
   * are config / race-condition bugs that another redirect won't fix —
   * propagate them as null without navigating.
   *
   * The "no account in cache" case is handled by detecting ORPHANED
   * STATE (no accounts but localStorage has MSAL token entries) and
   * cleaning the half-corrupted cache before redirecting. Without this,
   * the page renders authenticated UI but every API call goes anonymous.
   *
   * Errors are matched by ``name`` / ``errorCode`` rather than
   * ``instanceof`` because ``@azure/msal-browser`` is loaded via
   * dynamic import; the error class identity isn't shared across
   * module boundaries.
   *
   * ``forceRefresh: true`` skips MSAL's local cache and goes back to the
   * token endpoint with the cached refresh token. Use it from the
   * fetch interceptor when a protected API returns 401 — the first
   * attempt may have used a stale cached access token (claims
   * challenge, conditional-access re-eval, audience drift, etc.) that
   * MSAL still considered valid against its own clock.
   */
  getAccessToken: (
    audience?: "api" | "spaces",
    options?: { forceRefresh?: boolean },
  ) => Promise<string | null>;

  /**
   * Force interactive recovery: start an ``acquireTokenRedirect`` (or
   * ``loginRedirect`` fallback). Use this from the fetch interceptor
   * when even a force-refreshed access token still gets rejected by
   * the resource server (the silent path can't tell us "this is
   * fundamentally the wrong token" — it has to come from the protected
   * API saying 401 after we already retried). Throws
   * ``AuthInteractionRequiredError`` once the redirect has been kicked
   * off so the caller can stop processing.
   */
  recoverFromHardAuthFailure: (reason: unknown) => Promise<never>;
}

/** Recoverable error codes per MSAL.js docs — every one of these has the
 * documented remedy "invoke an interactive API". */
const RECOVERABLE_ERROR_CODES = new Set([
  // InteractionRequiredAuthError — canonical fallback case.
  "interaction_required",
  "login_required",
  "consent_required",
  // BrowserAuthError: monitor_window_timeout. Documented remedy includes
  // "Invoke an interactive API" (Microsoft Learn → "Common errors in
  // MSAL JS" → monitor_window_timeout → "Throttling" + "X-Frame-Options
  // Deny"). Real-world trigger on Chrome 120+ is third-party-iframe
  // storage partitioning blocking the silent SSO frame.
  "monitor_window_timeout",
]);

/** `InteractionRequiredAuthError` always triggers the redirect — match by
 * class name as a fallback when the error code isn't set. */
const INTERACTION_REQUIRED_NAME = "InteractionRequiredAuthError";

/** Module-level deduplication: when N parallel API calls all trip the
 * recovery path simultaneously, the second-onwards must reuse the first
 * one's promise rather than each issuing their own redirect. Without
 * this, MSAL throws ``interaction_in_progress`` on N-1 of them and the
 * cascading errors mask the actual recovery state. Mirrors the pattern
 * in the msal-react ``useMsalAuthentication`` hook + the production
 * patterns linked from Microsoft Learn's "Common errors" guide. */
let activeRecoveryPromise: Promise<never> | null = null;

function isRecoverableAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const code = (err as { errorCode?: string }).errorCode ?? "";
  return name === INTERACTION_REQUIRED_NAME || RECOVERABLE_ERROR_CODES.has(code);
}

function authErrorName(err: unknown): string | undefined {
  return err && typeof err === "object" ? (err as { name?: string }).name : undefined;
}

function authErrorCode(err: unknown): string | undefined {
  return err && typeof err === "object" ? (err as { errorCode?: string }).errorCode : undefined;
}

function authErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  return err && typeof err === "object" ? (err as { message?: string }).message : undefined;
}

function describeAuthError(err: unknown): string {
  const parts = [
    authErrorName(err) ? `name=${authErrorName(err)}` : undefined,
    authErrorCode(err) ? `code=${authErrorCode(err)}` : undefined,
    authErrorMessage(err) ? `message=${authErrorMessage(err)}` : undefined,
  ].filter(Boolean);
  return parts.join(", ");
}

function createInteractionRequiredError(
  tokenError: unknown,
  redirectError?: unknown,
): AuthInteractionRequiredError {
  const tokenDetail = describeAuthError(tokenError) || "unknown token acquisition error";
  const redirectDetail = redirectError ? describeAuthError(redirectError) : "";

  if (redirectError) {
    return new AuthInteractionRequiredError(
      `Authentication interaction required, but redirect failed (${redirectDetail}). Original token error: ${tokenDetail}.`,
      {
        code: authErrorCode(redirectError) ?? authErrorCode(tokenError),
        cause: redirectError,
      },
    );
  }

  return new AuthInteractionRequiredError(
    `Authentication interaction required after token acquisition failed (${tokenDetail}).`,
    {
      code: authErrorCode(tokenError),
      cause: tokenError,
    },
  );
}

/** Storage probe: does the browser have orphaned MSAL token entries with
 * no matching account record? That state is the "stuck on 401 forever"
 * signature — getAllAccounts() returns [] but the SPA still has tokens
 * lingering from a previous session that recovery half-cleaned. Returns
 * the list of MSAL keys to nuke; empty array means cache is coherent. */
function findOrphanedMsalKeys(): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const allKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith("msal.")) allKeys.push(k);
  }
  const tokenKeys = allKeys.filter((k) =>
    /\|(?:access|refresh|id)token\|/.test(k),
  );
  // No tokens = clean (or never logged in). Tokens AND empty
  // getAllAccounts means orphaned — caller is the only one who knows
  // the accounts state, so caller decides whether to nuke.
  return tokenKeys.length > 0 ? allKeys : [];
}

function nukeMsalLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    if (!store) continue;
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith("msal.")) toRemove.push(k);
    }
    toRemove.forEach((k) => store.removeItem(k));
  }
}

async function startInteractiveRecovery(
  msal: MsalClientApplication,
  account: MsalAccountInfo | null,
  scope: string,
  reason: unknown,
): Promise<never> {
  // Deduplicate concurrent recovery attempts. Multiple in-flight API
  // calls can simultaneously detect a stale token and trip recovery;
  // without this, MSAL throws ``interaction_in_progress`` on every
  // call after the first.
  if (activeRecoveryPromise) {
    return activeRecoveryPromise;
  }

  activeRecoveryPromise = (async () => {
    let redirectError: unknown;
    authStore.setState({ user: null, isAuthenticated: false });

    // Step 1: ``acquireTokenRedirect`` — the documented primitive for
    // refreshing a known account's tokens without forcing full
    // re-auth. Preserves the account record across the navigation,
    // which is critical: ``loginRedirect`` + pre-redirect
    // ``clearCache`` (the previous design) caused the orphaned-state
    // bug we just hit in production (account record gone, tokens
    // linger, every API call returns null token + 401 forever).
    if (account) {
      try {
        await msal.acquireTokenRedirect({ scopes: [scope], account });
        // If we reach here without navigating, MSAL settled the promise
        // before the browser navigation kicked in (test environments,
        // blocked redirects, etc.). Fall through to loginRedirect.
      } catch (err) {
        redirectError = err;
      }
    }

    // Step 2: full ``loginRedirect`` fallback. Used when:
    //   * No account was passed (orphaned-state caller)
    //   * acquireTokenRedirect threw a non-navigation error
    //   * acquireTokenRedirect settled without navigating
    // Still NO ``clearCache`` before this — let MSAL handle its own
    // state across the navigation. Only nuke localStorage if BOTH
    // redirect attempts fail (the orphaned-state caller does this
    // up-front because their state is already corrupt).
    try {
      await msal.loginRedirect({ scopes: [scope] });
    } catch (err) {
      redirectError = err;
    }

    throw createInteractionRequiredError(reason, redirectError);
  })();

  try {
    return await activeRecoveryPromise;
  } finally {
    activeRecoveryPromise = null;
  }
}

export const authStore = createStore<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  signIn: (user) => set({ user, isAuthenticated: true }),

  signOut: () => {
    set({ user: null, isAuthenticated: false });
    const msal = getMsalInstance();
    if (msal) {
      msal.logoutRedirect();
    }
  },

  getAccessToken: async (_audience = "api", options) => {
    const msal = getMsalInstance();
    const config = getMsalConfig();
    if (!msal || !config) return null;

    const accounts = msal.getAllAccounts();
    const scope = config.apiScope;

    // Orphaned-state recovery: ``getAllAccounts()`` returns [] BUT
    // localStorage still holds MSAL token entries. That happens when a
    // previous recovery attempt cleared the account record but its
    // redirect didn't navigate (browser policy, popup blocker, async
    // race). The SPA renders "logged in" but every API call goes
    // anonymous. Nuke the orphans + force a fresh redirect so the
    // user gets unstuck without manually clearing browser storage.
    if (accounts.length === 0) {
      const orphans = findOrphanedMsalKeys();
      if (orphans.length > 0) {
        nukeMsalLocalStorage();
        return startInteractiveRecovery(
          msal,
          null,
          scope,
          new Error(
            `Detected orphaned MSAL state (${orphans.length} cache entries with no account record); cleaned up + redirecting`,
          ),
        );
      }
      // Truly logged out — ``AuthGuard`` will call ``loginRedirect`` on
      // its next render. Don't double-redirect from here.
      return null;
    }

    const forceRefresh = options?.forceRefresh === true;

    try {
      const result = await msal.acquireTokenSilent({
        scopes: [scope],
        account: accounts[0],
        forceRefresh,
      });
      return result.accessToken;
    } catch (err) {
      if (isRecoverableAuthError(err)) {
        return startInteractiveRecovery(msal, accounts[0], scope, err);
      }
      return null;
    }
  },

  recoverFromHardAuthFailure: async (reason) => {
    // Fetch interceptor's escape hatch: silent path produced a token
    // but the resource server rejected it (audience drift, conditional-
    // access re-eval, claims challenge, tenant-policy change, etc.).
    // Same recovery primitive as the silent-failure path —
    // acquireTokenRedirect → loginRedirect — invoked from the
    // resource-server signal rather than an MSAL exception.
    const msal = getMsalInstance();
    const config = getMsalConfig();
    if (!msal || !config) {
      throw new AuthInteractionRequiredError(
        "Authentication interaction required (no MSAL instance configured).",
        { cause: reason },
      );
    }
    const accounts = msal.getAllAccounts();
    return startInteractiveRecovery(
      msal,
      accounts[0] ?? null,
      config.apiScope,
      reason,
    );
  },
}));
