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
    expect(await store().getAccessToken("api", { forceRefresh: true })).toBe("fresh-token");
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true }),
    );
  });

  it("recoverFromHardAuthFailure evicts bad account + redirects with prompt:'login'", async () => {
    // When the fetch interceptor's force-refresh retry STILL gets 401,
    // server-side drift (audience / claims / conditional-access) means
    // we need a fresh interactive auth. Two non-negotiable behaviours
    // that prevent the "silent redirect loop":
    //   1. ``clearCache({ account })`` BEFORE redirect — evicts the
    //      bad refresh-token / claims so MSAL doesn't reuse the same
    //      poisoned material after the redirect lands.
    //   2. ``prompt: "login"`` on BOTH redirect primitives — forces
    //      Entra to re-prompt for credentials instead of silently
    //      returning the SAME stale token from its server-side SSO
    //      session.
    // See GitHub #6840 and the Microsoft Identity Platform "claims
    // challenge" guidance.
    const msal = mockMsal();
    const reason = new Error("API returned 401 after force-refresh retry");
    await expectInteractiveRecoveryError(store().recoverFromHardAuthFailure(reason), {
      code: undefined,
      cause: reason,
      messageIncludes: ["interaction required"],
    });
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.clearCache).toHaveBeenCalledWith({
      account: { username: "alice@example.com", localAccountId: "alice-oid" },
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
  });

  it("forwards a claims-challenge payload from the failure reason to MSAL", async () => {
    // Continuous Access Evaluation / Conditional-Access challenge:
    // the fetch interceptor extracted ``claims`` from the resource
    // server's ``WWW-Authenticate`` header and stamped it onto the
    // recovery reason. The redirect must carry it through so Entra
    // mints a token that explicitly satisfies the challenge.
    const msal = mockMsal();
    const reason = Object.assign(new Error("API returned 401 after force-refresh retry"), {
      claims: "eyJjbGFpbXMiOiIuLi4ifQ",
    });
    await expectInteractiveRecoveryError(store().recoverFromHardAuthFailure(reason), {
      code: undefined,
      cause: reason,
      messageIncludes: ["interaction required"],
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: "eyJjbGFpbXMiOiIuLi4ifQ",
        prompt: "login",
      }),
    );
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

  it("uses acquireTokenRedirect on InteractionRequiredAuthError, evicting the bad account first", async () => {
    // Canonical 2026 MSAL.js recovery pattern (per Microsoft Identity
    // Platform docs + GitHub #6840):
    //   1. ``clearCache({ account })`` — surgical eviction of the bad
    //      token + claims, BEFORE redirect. The earlier
    //      "no-clearCache-before-redirect" rule was about the broad
    //      ``clearCache()`` form (which produces the orphaned-state
    //      bug); the per-account form is the documented fix.
    //   2. ``acquireTokenRedirect`` with ``prompt: "login"`` — forces
    //      re-prompt instead of letting Entra silently reuse the SSO
    //      session.
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
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.clearCache).toHaveBeenCalledWith({
      account: { username: "alice@example.com", localAccountId: "alice-oid" },
    });
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith({
      scopes: [config.apiScope],
      account: { username: "alice@example.com", localAccountId: "alice-oid" },
      prompt: "login",
    });
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

  it("recovers on consent_required by evicting bad account + acquireTokenRedirect", async () => {
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
    expect(msal.clearCache).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({ localAccountId: "alice-oid" }),
      }),
    );
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
  });

  it("recovers on monitor_window_timeout by evicting bad account + acquireTokenRedirect", async () => {
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
    expect(msal.clearCache).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({ localAccountId: "alice-oid" }),
      }),
    );
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
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
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
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
    expect(msal.acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "login" }),
    );
    expect(msal.loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ prompt: "login" }));
    // Per-account cache eviction DID happen as the canonical pre-
    // redirect step (see GitHub #6840). The "no clearCache" rule
    // applies only to the broad ``clearCache()`` form, not the
    // ``clearCache({ account })`` variant we use here.
    expect(msal.clearCache).toHaveBeenCalledOnce();
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
    const remainingMsalKeys = Object.keys(localStorage).filter((k) => k.startsWith("msal."));
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

describe("authStore — block_iframe_reload defuse", () => {
  // MSAL.js refuses to redirect when the current URL fragment still
  // carries a prior silent-auth failure (``#error=…``). In production
  // we shipped clearCache + prompt:'login' but users were STILL stuck
  // because the redirect itself was aborting with
  // ``BrowserAuthError: block_iframe_reload``. The fix:
  // ``startInteractiveRecovery`` must strip the error fragment from
  // the URL with ``history.replaceState`` BEFORE calling
  // ``acquireTokenRedirect`` / ``loginRedirect``.

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
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: "fresh" }),
      acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
      acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: "popup" }),
      ...overrides,
    };
    vi.spyOn(authConfig, "getMsalInstance").mockReturnValue(mock);
    vi.spyOn(authConfig, "getMsalConfig").mockReturnValue(config);
    return mock;
  }

  beforeEach(() => {
    // Reset URL fragment between tests.
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("strips a stale MSAL error fragment before calling acquireTokenRedirect", async () => {
    window.history.replaceState(
      null,
      "",
      "/spaces/some-entity?foo=bar" +
        "#error=interaction_required" +
        "&error_description=AADSTS160021%3a+Application+requested+a+user+session+which+does+not+exist" +
        "&state=eyJpZCI6IngifQ%3D%3D",
    );
    expect(window.location.hash).toContain("error=interaction_required");

    const msal = mockMsal();
    const reason = new Error("API returned 401 after force-refresh retry");
    let acquireRedirectHash: string | null = null;
    msal.acquireTokenRedirect = vi.fn(async () => {
      acquireRedirectHash = window.location.hash;
    });

    await expect(authStore.getState().recoverFromHardAuthFailure(reason)).rejects.toBeInstanceOf(
      AuthInteractionRequiredError,
    );

    // By the time MSAL's redirect API is called, the page fragment
    // has been wiped. MSAL won't see the stale ``error=`` and won't
    // trip its ``block_iframe_reload`` guard.
    expect(acquireRedirectHash).toBe("");
    // Path + query string are preserved so the post-redirect landing
    // page is the SAME page the user was on when their session went
    // bad.
    expect(window.location.pathname).toBe("/spaces/some-entity");
    expect(window.location.search).toBe("?foo=bar");
  });

  it("leaves a clean URL alone (no spurious history mutation)", async () => {
    window.history.replaceState(null, "", "/spaces?clean=1");
    const original = window.location.href;
    const msal = mockMsal();
    await expect(
      authStore.getState().recoverFromHardAuthFailure(new Error("policy drift")),
    ).rejects.toBeInstanceOf(AuthInteractionRequiredError);
    // Path + query stay identical (no replaceState invocation).
    expect(window.location.href).toBe(original);
    expect(msal.acquireTokenRedirect).toHaveBeenCalledOnce();
  });

  it("strips error_code / error_uri fragments too (not just error_description)", async () => {
    window.history.replaceState(
      null,
      "",
      "/spaces#error_code=AADSTS160021&error_uri=https%3a%2f%2flogin.example",
    );
    const msal = mockMsal();
    let hashAtRedirect: string | null = null;
    msal.acquireTokenRedirect = vi.fn(async () => {
      hashAtRedirect = window.location.hash;
    });
    await expect(
      authStore.getState().recoverFromHardAuthFailure(new Error("x")),
    ).rejects.toBeInstanceOf(AuthInteractionRequiredError);
    expect(hashAtRedirect).toBe("");
  });
});
