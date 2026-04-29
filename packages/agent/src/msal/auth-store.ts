import { createStore } from "zustand/vanilla";
import { getMsalInstance, getMsalConfig } from "./auth-config.ts";

export interface AuthUser {
  name: string;
  email: string;
  avatar?: string;
  oid?: string;
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
   * Recovery semantics — modern browsers (Chrome 120+, Edge, Safari)
   * partition third-party storage, so MSAL's hidden-iframe silent SSO
   * is increasingly fragile. This method handles three failure modes:
   *
   *   1. No cached account → trigger `loginRedirect`. Common after
   *      browser storage cleanup or a refresh-token expiry.
   *   2. `acquireTokenSilent` throws `InteractionRequiredAuthError`
   *      (consent revoked, MFA, password change) → trigger
   *      `acquireTokenRedirect` to preserve the account.
   *   3. `acquireTokenSilent` throws `BrowserAuthError` (the silent
   *      iframe was blocked, `monitor_window_timeout`, etc.) →
   *      trigger `acquireTokenRedirect`. The top-level navigation
   *      bypasses the iframe-storage restriction.
   *
   * Errors are matched by `name` / `errorCode` rather than `instanceof`
   * because `@azure/msal-browser` is loaded via dynamic import; the
   * error class identity isn't shared across module boundaries.
   */
  getAccessToken: (audience?: "api" | "spaces") => Promise<string | null>;
}

/** Error codes from `@azure/msal-browser` we recover from with a redirect. */
const RECOVERABLE_ERROR_CODES = new Set([
  // InteractionRequiredAuthError
  "interaction_required",
  "login_required",
  "consent_required",
  // BrowserAuthError — silent iframe path failed
  "monitor_window_timeout",
  "interaction_in_progress",
  "no_account_in_silent_request",
  "hash_does_not_contain_known_properties",
  "hash_empty_error",
  "non_browser_environment",
]);

const RECOVERABLE_ERROR_NAMES = new Set([
  "InteractionRequiredAuthError",
  "BrowserAuthError",
]);

function isRecoverableAuthError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  const code = (err as { errorCode?: string } | null)?.errorCode ?? "";
  return RECOVERABLE_ERROR_NAMES.has(name) || RECOVERABLE_ERROR_CODES.has(code);
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

  getAccessToken: async (_audience = "api") => {
    const msal = getMsalInstance();
    const config = getMsalConfig();
    if (!msal || !config) return null;

    // Single API-scoped token — Spaces accepts both audiences (multi-audience JWT).
    const scope = config.apiScope;

    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) {
      // No cached account. Silent SSO failed entirely (likely a
      // third-party-iframe-storage block) or the user never signed
      // in. Either way, only a top-level loginRedirect can recover.
      try {
        await msal.loginRedirect({ scopes: [scope] });
      } catch {
        // Redirect navigates away; nothing to return.
      }
      return null;
    }

    try {
      const result = await msal.acquireTokenSilent({
        scopes: [scope],
        account: accounts[0],
      });
      return result.accessToken;
    } catch (err) {
      // Recoverable failures get a top-level redirect.
      // Anything else is propagated as null without navigating
      // (transient network errors shouldn't bounce the user).
      if (isRecoverableAuthError(err)) {
        try {
          await msal.acquireTokenRedirect({
            scopes: [scope],
            account: accounts[0],
          });
        } catch {
          // Redirect navigates away; nothing to return.
        }
      }
      return null;
    }
  },
}));
