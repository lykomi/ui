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
   *   Try acquireTokenSilent first, then use an interactive redirect when
   *   MSAL reports that user interaction is required.
   *
   * Plus one extra recoverable case explicitly called out in those docs:
   * `BrowserAuthError: monitor_window_timeout`. Microsoft's recommendation
   * is to either backoff, fix the redirectUri page, or "invoke an
   * interactive API such as acquireTokenPopup or acquireTokenRedirect" —
   * we take the last option, which matches third-party-iframe storage
   * blocking on Chrome 120+ / Edge / Safari (the silent iframe times
   * out because the cross-site cookie is partitioned).
   *
   * Before starting that redirect, clear the stale local account/token
   * cache. This avoids the broken half-authenticated state where the SPA
   * still renders an account but every API call goes out without a bearer
   * token after MSAL returned `interaction_required`.
   *
   * Recoverable auth failures reject with `AuthInteractionRequiredError`
   * after recovery has been started. The error exposes `code` and `cause`
   * so callers can distinguish a normal interaction-required redirect from
   * a blocked/failed redirect attempt.
   *
   * Other `BrowserAuthError` codes (`interaction_in_progress`,
   * `hash_empty_error`, `hash_does_not_contain_known_properties`,
   * `block_iframe_reload`) are config / race-condition bugs that another
   * redirect won't fix — propagate them as null without navigating.
   *
   * The "no account in cache" case is handled at boot by `AuthGuard`,
   * which calls `loginRedirect` when `accounts.length === 0`. If we
   * still reach this method without an account, it's an unusual state;
   * return null and let the next AuthGuard render recover.
   *
   * Errors are matched by `name` / `errorCode` rather than `instanceof`
   * because `@azure/msal-browser` is loaded via dynamic import; the
   * error class identity isn't shared across module boundaries.
   *
   * `forceRefresh: true` skips MSAL's local cache and goes back to the
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
   * Force interactive recovery: clear MSAL's cache for the active account
   * and start a ``loginRedirect``. Use this from the fetch interceptor
   * when even a force-refreshed access token still gets rejected by the
   * resource server (the silent path can't tell us "this is fundamentally
   * the wrong token" — it has to come from the protected API saying 401
   * after we already retried). Throws ``AuthInteractionRequiredError``
   * once the redirect has been kicked off so the caller can stop processing.
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

let interactiveRecoveryStarted = false;

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
      `Authentication interaction required, but login redirect failed (${redirectDetail}). Original token error: ${tokenDetail}.`,
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

async function startInteractiveRecovery(
  msal: MsalClientApplication,
  account: MsalAccountInfo,
  scope: string,
  reason: unknown,
): Promise<never> {
  let redirectError: unknown;
  if (!interactiveRecoveryStarted) {
    interactiveRecoveryStarted = true;
    authStore.setState({ user: null, isAuthenticated: false });
    msal.setActiveAccount(null);
    await msal.clearCache({ account }).catch(() => undefined);
    try {
      await msal.loginRedirect({ scopes: [scope] });
    } catch (err) {
      // The redirect is expected to navigate away; if it settles by throwing,
      // keep that failure attached so logs/UI can show what blocked recovery.
      redirectError = err;
    } finally {
      // In tests or blocked-popup environments the promise can settle without
      // navigation. Allow a later user action/retry to start recovery again.
      interactiveRecoveryStarted = false;
    }
  }
  throw createInteractionRequiredError(reason, redirectError);
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
    if (accounts.length === 0) {
      // No cached account — `AuthGuard` will call `loginRedirect` on
      // its next render. Don't double-redirect from here.
      return null;
    }

    // Single API-scoped token — Spaces accepts both audiences (multi-audience JWT).
    const scope = config.apiScope;
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
    // The silent path produced a token but the resource server rejected
    // it (audience drift, conditional-access re-eval, claims challenge,
    // tenant-policy change, etc.). The cached refresh token can't help
    // — a token minted from it would carry the same identity claims —
    // so the only correct UX is a full ``loginRedirect`` that produces
    // a fresh token bound to the current server policy.
    const msal = getMsalInstance();
    const config = getMsalConfig();
    if (!msal || !config) {
      throw new AuthInteractionRequiredError(
        "Authentication interaction required (no MSAL instance configured).",
        { cause: reason },
      );
    }
    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) {
      throw new AuthInteractionRequiredError(
        "Authentication interaction required (no cached account).",
        { cause: reason },
      );
    }
    return startInteractiveRecovery(msal, accounts[0], config.apiScope, reason);
  },
}));
