import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInteractionRequiredError, authStore } from "../msal/auth-store.ts";
import * as authConfig from "../msal/auth-config.ts";

const store = () => authStore.getState();

describe("authStore", () => {
  beforeEach(() => {
    authStore.setState({ user: null, isAuthenticated: false });
  });

  it("starts unauthenticated", () => {
    expect(store().isAuthenticated).toBe(false);
    expect(store().user).toBeNull();
  });

  it("signs in with a user", () => {
    store().signIn({ name: "Alice", email: "alice@example.com" });
    expect(store().isAuthenticated).toBe(true);
    expect(store().user?.name).toBe("Alice");
  });

  it("signs out and clears user", () => {
    store().signIn({ name: "Alice", email: "alice@example.com" });
    store().signOut();
    expect(store().isAuthenticated).toBe(false);
    expect(store().user).toBeNull();
  });

  it("signs in with avatar", () => {
    store().signIn({
      name: "Bob",
      email: "bob@example.com",
      avatar: "https://example.com/bob.png",
    });
    expect(store().user?.avatar).toBe("https://example.com/bob.png");
  });
});

describe("authStore.getAccessToken — canonical MSAL.js fallback", () => {
  // Reference: https://learn.microsoft.com/entra/msal/javascript/browser/errors
  const config = {
    clientId: "test-client",
    authority: "https://login.microsoftonline.com/test-tenant",
    redirectUri: "http://localhost:8010",
    apiScope: "api://test-api/access_as_user",
  };

  function mockMsal(overrides: Record<string, unknown> = {}) {
    const account = { username: "alice@example.com", localAccountId: "alice-oid" };
    const mock = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      clearCache: vi.fn().mockResolvedValue(undefined),
      getAllAccounts: vi.fn().mockReturnValue([account]),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      setActiveAccount: vi.fn(),
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: "fresh-token" }),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
      acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: "popup-token" }),
      ...overrides,
    };
    vi.spyOn(authConfig, "getMsalInstance").mockReturnValue(mock);
    vi.spyOn(authConfig, "getMsalConfig").mockReturnValue(config);
    return mock;
  }

  async function expectInteractiveRecoveryError(
    promise: Promise<unknown>,
    expected: {
      code?: string;
      cause: unknown;
      messageIncludes: string[];
    },
  ) {
    let thrown: unknown;
    try {
      await promise;
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AuthInteractionRequiredError);
    const authError = thrown as AuthInteractionRequiredError;
    expect(authError.code).toBe(expected.code);
    expect(authError.cause).toBe(expected.cause);
    for (const value of expected.messageIncludes) {
      expect(authError.message).toContain(value);
    }
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null without navigating when MSAL isn't configured", async () => {
    vi.spyOn(authConfig, "getMsalInstance").mockReturnValue(null);
    vi.spyOn(authConfig, "getMsalConfig").mockReturnValue(null);
    expect(await store().getAccessToken()).toBeNull();
  });

  it("returns the access token on a normal silent acquire", async () => {
    const msal = mockMsal();
    expect(await store().getAccessToken()).toBe("fresh-token");
    expect(msal.acquireTokenSilent).toHaveBeenCalledOnce();
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: false }),
    );
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).not.toHaveBeenCalled();
  });

  it("forwards forceRefresh to acquireTokenSilent on the 401-retry path", async () => {
    // The fetch interceptor passes ``{ forceRefresh: true }`` after a
    // protected API returns 401. MSAL must skip its local cache and round-
    // trip the token endpoint so we stop sending the same stale-but-cached
    // access token.
    const msal = mockMsal();
    expect(await store().getAccessToken("api", { forceRefresh: true })).toBe(
      "fresh-token",
    );
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
  });

  it("recoverFromHardAuthFailure starts acquireTokenRedirect (preserves account)", async () => {
    // When the fetch interceptor's force-refresh retry STILL gets 401,
    // server-side drift (audience / claims / conditional-access) means
    // we need a fresh interactive auth. Same recovery primitive as the
    // silent-failure path: ``acquireTokenRedirect`` first (preserves
    // the account record), ``loginRedirect`` only as fallback. Cache
    // is NOT cleared before redirect.
    const msal = mockMsal();
    const reason = new Error("API returned 401 after force-refresh retry");
    await expectInteractiveRecoveryError(
      store().recoverFromHardAuthFailure(reason),
      {
        code: undefined,
        cause: reason,
        messageIncludes: ["interaction required"],
      },
    );
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.clearCache).not.toHaveBeenCalled();
  });

  it("returns null without redirecting when no account is cached", async () => {
    // AuthGuard calls loginRedirect when accounts.length === 0; double-
    // redirecting from getAccessToken would race with AuthGuard.
    const msal = mockMsal({ getAllAccounts: vi.fn().mockReturnValue([]) });
    expect(await store().getAccessToken()).toBeNull();
    expect(msal.acquireTokenSilent).not.toHaveBeenCalled();
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).not.toHaveBeenCalled();
  });

  it("uses acquireTokenRedirect on InteractionRequiredAuthError (preserves account)", async () => {
    // Canonical 2026 MSAL.js pattern: ``acquireTokenRedirect`` is the
    // documented primitive for refreshing a known account's tokens
    // without a full ``loginRedirect``. Critically, the cache is NOT
    // cleared before the redirect — that was the orphaned-state bug
    // (account record gone + tokens lingering when redirect fails).
    const err = Object.assign(new Error("MFA required"), {
      name: "InteractionRequiredAuthError",
      errorCode: "interaction_required",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expectInteractiveRecoveryError(store().getAccessToken(), {
      code: "interaction_required",
      cause: err,
      messageIncludes: [
        "Authentication interaction required",
        "InteractionRequiredAuthError",
        "interaction_required",
        "MFA required",
      ],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith({
      scopes: [config.apiScope],
      account: { username: "alice@example.com", localAccountId: "alice-oid" },
    });
    // Cache MUST NOT be cleared before redirect — see
    // AzureAD/microsoft-authentication-library-for-js#7551 and the
    // orphaned-state production bug this fix exists to address.
    expect(msal.clearCache).not.toHaveBeenCalled();
    expect(msal.setActiveAccount).not.toHaveBeenCalled();
  });

  it("falls back to loginRedirect when acquireTokenRedirect returns without navigating", async () => {
    // ``acquireTokenRedirect`` resolves before navigation in some
    // environments (test runners, blocked redirects). When it settles
    // without throwing AND without navigating, fall through to a full
    // ``loginRedirect`` so the user still gets through the auth flow.
    const err = Object.assign(new Error("interaction"), {
      name: "InteractionRequiredAuthError",
      errorCode: "interaction_required",
    });
    const msal = mockMsal({
      acquireTokenSilent: vi.fn().mockRejectedValue(err),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    });
    await expectInteractiveRecoveryError(store().getAccessToken(), {
      code: "interaction_required",
      cause: err,
      messageIncludes: ["Authentication interaction required"],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
  });

  it("recovers on consent_required without clearing cache before redirect", async () => {
    const err = Object.assign(new Error("consent required"), {
      name: "InteractionRequiredAuthError",
      errorCode: "consent_required",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expectInteractiveRecoveryError(store().getAccessToken(), {
      code: "consent_required",
      cause: err,
      messageIncludes: ["Authentication interaction required", "consent_required"],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.clearCache).not.toHaveBeenCalled();
  });

  it("recovers on monitor_window_timeout without clearing cache before redirect", async () => {
    // Microsoft Learn → "Common errors in MSAL JS" → monitor_window_timeout
    // → documented remedy includes "Invoke an interactive API".
    const err = Object.assign(new Error("monitor_window_timeout"), {
      name: "BrowserAuthError",
      errorCode: "monitor_window_timeout",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expectInteractiveRecoveryError(store().getAccessToken(), {
      code: "monitor_window_timeout",
      cause: err,
      messageIncludes: ["Authentication interaction required", "monitor_window_timeout"],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.clearCache).not.toHaveBeenCalled();
  });

  it("does NOT redirect on interaction_in_progress (would race with another flow)", async () => {
    const err = Object.assign(new Error("interaction_in_progress"), {
      name: "BrowserAuthError",
      errorCode: "interaction_in_progress",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    expect(await store().getAccessToken()).toBeNull();
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it("does NOT redirect on hash_empty_error (config bug, redirect won't fix)", async () => {
    const err = Object.assign(new Error("hash_empty_error"), {
      name: "BrowserAuthError",
      errorCode: "hash_empty_error",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    expect(await store().getAccessToken()).toBeNull();
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it("does NOT redirect on a transient/unknown error", async () => {
    // A network blip shouldn't bounce the user through a login flow.
    const err = new Error("connection reset");
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    expect(await store().getAccessToken()).toBeNull();
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).not.toHaveBeenCalled();
  });

  it("matches InteractionRequiredAuthError by class name when no errorCode is set", async () => {
    const err = Object.assign(new Error("interaction"), {
      name: "InteractionRequiredAuthError",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expectInteractiveRecoveryError(store().getAccessToken(), {
      cause: err,
      messageIncludes: ["Authentication interaction required", "InteractionRequiredAuthError"],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.clearCache).not.toHaveBeenCalled();
  });

  it("preserves redirect failure details when both redirect attempts fail", async () => {
    const tokenErr = Object.assign(new Error("MFA required"), {
      name: "InteractionRequiredAuthError",
      errorCode: "interaction_required",
    });
    const acquireErr = Object.assign(new Error("acquireToken redirect blocked"), {
      name: "BrowserAuthError",
      errorCode: "redirect_failed",
    });
    const loginErr = Object.assign(new Error("login redirect blocked"), {
      name: "BrowserAuthError",
      errorCode: "redirect_failed_login",
    });
    const msal = mockMsal({
      acquireTokenSilent: vi.fn().mockRejectedValue(tokenErr),
      acquireTokenRedirect: vi.fn().mockRejectedValue(acquireErr),
      loginRedirect: vi.fn().mockRejectedValue(loginErr),
    });

    await expectInteractiveRecoveryError(store().getAccessToken(), {
      code: "redirect_failed_login",
      cause: loginErr,
      messageIncludes: [
        "Authentication interaction required",
        "redirect failed",
        "redirect_failed_login",
        "Original token error",
        "interaction_required",
      ],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
    // Even on full failure, cache is NOT touched — leaves state intact
    // for the next attempt rather than creating an orphaned cache.
    expect(msal.clearCache).not.toHaveBeenCalled();
  });
});

describe("authStore — orphaned-state recovery", () => {
  // Production bug: a previous recovery cleared the account record but
  // its redirect didn't navigate (browser policy, popup blocker, etc.).
  // localStorage is left with token entries but ``getAllAccounts()``
  // returns []. Every subsequent API call gets null token + 401 forever
  // until manual ``localStorage.clear()``.

  const config = {
    clientId: "test-client",
    authority: "https://login.microsoftonline.com/test-tenant",
    redirectUri: "http://localhost:8010",
    apiScope: "api://test-api/access_as_user",
  };

  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("detects orphaned state, nukes localStorage, and triggers fresh login", async () => {
    // Seed the orphan: token-shaped MSAL keys but no account record.
    localStorage.setItem(
      "msal.3|home-id.tenant|login.windows.net|accesstoken|client|tenant|scope|",
      JSON.stringify({ id: "x", nonce: "n", data: "encrypted-blob", lastUpdatedAt: "0" }),
    );
    localStorage.setItem(
      "msal.3|home-id.tenant|login.windows.net|refreshtoken|client|||",
      JSON.stringify({ id: "x", nonce: "n", data: "encrypted-blob", lastUpdatedAt: "0" }),
    );
    localStorage.setItem(
      "msal.client.active-account-filters",
      JSON.stringify({ homeAccountId: "home-id.tenant" }),
    );

    const msal = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      clearCache: vi.fn().mockResolvedValue(undefined),
      // CRITICAL: the orphaned-state — empty accounts despite localStorage entries.
      getAllAccounts: vi.fn().mockReturnValue([]),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      setActiveAccount: vi.fn(),
      acquireTokenSilent: vi.fn(),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
      acquireTokenPopup: vi.fn(),
    };
    vi.spyOn(authConfig, "getMsalInstance").mockReturnValue(msal);
    vi.spyOn(authConfig, "getMsalConfig").mockReturnValue(config);

    let thrown: unknown;
    try {
      await authStore.getState().getAccessToken();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AuthInteractionRequiredError);
    expect((thrown as AuthInteractionRequiredError).message).toMatch(/orphaned/i);

    // localStorage should have been nuked of all msal.* keys.
    const remainingMsalKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith("msal."),
    );
    expect(remainingMsalKeys).toEqual([]);

    // No account → recovery skips acquireTokenRedirect and goes
    // straight to loginRedirect.
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
  });

  it("returns null on truly clean no-account state (no orphan)", async () => {
    // No MSAL keys in localStorage and no accounts — user genuinely
    // hasn't logged in yet. AuthGuard handles ``loginRedirect`` on
    // its render; we don't double-redirect from here.
    const msal = {
      initialize: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
      clearCache: vi.fn().mockResolvedValue(undefined),
      getAllAccounts: vi.fn().mockReturnValue([]),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      setActiveAccount: vi.fn(),
      acquireTokenSilent: vi.fn(),
      acquireTokenRedirect: vi.fn(),
      acquireTokenPopup: vi.fn(),
    };
    vi.spyOn(authConfig, "getMsalInstance").mockReturnValue(msal);
    vi.spyOn(authConfig, "getMsalConfig").mockReturnValue(config);

    expect(await authStore.getState().getAccessToken()).toBeNull();
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).not.toHaveBeenCalled();
  });
});
