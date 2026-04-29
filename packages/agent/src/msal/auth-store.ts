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
   * Recovery semantics — follows the canonical MSAL.js pattern documented
   * at https://learn.microsoft.com/entra/msal/javascript/browser/errors:
   *
   *   try {
   *     await msal.acquireTokenSilent(req);
   *   } catch (error) {
   *     if (error instanceof InteractionRequiredAuthError) {
   *       await msal.acquireTokenRedirect(req);
   *     }
   *   }
   *
   * Plus one extra recoverable case explicitly called out in those docs:
   * `BrowserAuthError: monitor_window_timeout`. Microsoft's recommendation
   * is to either backoff, fix the redirectUri page, or "invoke an
   * interactive API such as acquireTokenPopup or acquireTokenRedirect" —
   * we take the last option, which matches third-party-iframe storage
   * blocking on Chrome 120+ / Edge / Safari (the silent iframe times
   * out because the cross-site cookie is partitioned).
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
   */
  getAccessToken: (audience?: "api" | "spaces") => Promise<string | null>;
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

function isRecoverableAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const code = (err as { errorCode?: string }).errorCode ?? "";
  return name === INTERACTION_REQUIRED_NAME || RECOVERABLE_ERROR_CODES.has(code);
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

    const accounts = msal.getAllAccounts();
    if (accounts.length === 0) {
      // No cached account — `AuthGuard` will call `loginRedirect` on
      // its next render. Don't double-redirect from here.
      return null;
    }

    // Single API-scoped token — Spaces accepts both audiences (multi-audience JWT).
    const scope = config.apiScope;

    try {
      const result = await msal.acquireTokenSilent({
        scopes: [scope],
        account: accounts[0],
      });
      return result.accessToken;
    } catch (err) {
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
