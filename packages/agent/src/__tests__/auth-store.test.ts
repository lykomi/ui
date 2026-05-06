import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "../msal/auth-store.ts";
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
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(msal.loginRedirect).not.toHaveBeenCalled();
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

  it("clears stale cache and redirects on InteractionRequiredAuthError", async () => {
    const err = Object.assign(new Error("MFA required"), {
      name: "InteractionRequiredAuthError",
      errorCode: "interaction_required",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expect(store().getAccessToken()).rejects.toThrow(
      "Authentication interaction required",
    );
    expect(msal.clearCache).toHaveBeenCalledWith({
      account: { username: "alice@example.com", localAccountId: "alice-oid" },
    });
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledWith({
      scopes: [config.apiScope],
    });
    expect(msal.acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it("clears stale cache and redirects on consent_required", async () => {
    const err = Object.assign(new Error("consent required"), {
      name: "InteractionRequiredAuthError",
      errorCode: "consent_required",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expect(store().getAccessToken()).rejects.toThrow(
      "Authentication interaction required",
    );
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
  });

  it("clears stale cache and redirects on monitor_window_timeout", async () => {
    // Microsoft Learn → "Common errors in MSAL JS" → monitor_window_timeout
    // → documented remedy includes "Invoke an interactive API".
    const err = Object.assign(new Error("monitor_window_timeout"), {
      name: "BrowserAuthError",
      errorCode: "monitor_window_timeout",
    });
    const msal = mockMsal({ acquireTokenSilent: vi.fn().mockRejectedValue(err) });
    await expect(store().getAccessToken()).rejects.toThrow(
      "Authentication interaction required",
    );
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
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
    await expect(store().getAccessToken()).rejects.toThrow(
      "Authentication interaction required",
    );
    expect(msal.clearCache).toHaveBeenCalledOnce();
    expect(msal.loginRedirect).toHaveBeenCalledOnce();
  });
});
