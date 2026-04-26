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
   */
  getAccessToken: (audience?: "api" | "spaces") => Promise<string | null>;
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
    if (accounts.length === 0) return null;

    // Single API-scoped token — Spaces accepts both audiences (multi-audience JWT)
    const scope = config.apiScope;

    try {
      const result = await msal.acquireTokenSilent({
        scopes: [scope],
        account: accounts[0],
      });
      return result.accessToken;
    } catch {
      // Silent acquisition failed — trigger interactive redirect
      try {
        await msal.acquireTokenRedirect({
          scopes: [scope],
          account: accounts[0],
        });
      } catch {
        // Redirect will navigate away; nothing to return
      }
      return null;
    }
  },
}));
