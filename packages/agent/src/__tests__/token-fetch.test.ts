import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();
const recoverFromHardAuthFailure = vi.fn();

vi.mock("../msal/auth-store.ts", () => ({
  authStore: {
    getState: () => ({
      getAccessToken,
      recoverFromHardAuthFailure,
    }),
  },
}));

import { tokenFetch } from "../msal/token-fetch.ts";

describe("tokenFetch", () => {
  beforeEach(() => {
    getAccessToken.mockReset();
    recoverFromHardAuthFailure.mockReset();
    vi.restoreAllMocks();
  });

  it("merges Request headers and lets init headers take precedence", async () => {
    getAccessToken.mockResolvedValue("test-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const request = new Request("https://example.com/api/items", {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Only": "request",
        "X-Override": "request",
      },
    });

    await tokenFetch(request, {
      headers: {
        "X-Init-Only": "init",
        "X-Override": "init",
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Request-Only")).toBe("request");
    expect(headers.get("X-Init-Only")).toBe("init");
    expect(headers.get("X-Override")).toBe("init");
  });

  it("falls through to native fetch when no token is available", async () => {
    getAccessToken.mockResolvedValue(null);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await tokenFetch("https://example.com/api/items");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init).toBeUndefined();
  });

  it("retries once with forceRefresh when first attempt returns 401", async () => {
    // Long-lived tab path: cached token is rejected by the API → MSAL is
    // asked to round-trip the token endpoint with the refresh token.
    getAccessToken
      .mockResolvedValueOnce("stale-token")
      .mockResolvedValueOnce("fresh-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const res = await tokenFetch("https://example.com/api/items");

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenNthCalledWith(1, "api", undefined);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, "api", { forceRefresh: true });

    const firstAuth = new Headers(fetchSpy.mock.calls[0]![1]?.headers).get(
      "Authorization",
    );
    const secondAuth = new Headers(fetchSpy.mock.calls[1]![1]?.headers).get(
      "Authorization",
    );
    expect(firstAuth).toBe("Bearer stale-token");
    expect(secondAuth).toBe("Bearer fresh-token");
  });

  it("does not retry on non-401 responses", async () => {
    getAccessToken.mockResolvedValue("token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    const res = await tokenFetch("https://example.com/api/items");

    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it("escalates to interactive recovery on a hard 401-then-401 path", async () => {
    // Server-policy drift: even the force-refreshed token is rejected.
    // The fetch interceptor must call ``recoverFromHardAuthFailure`` so
    // the auth layer can kick off ``loginRedirect``. The recovery
    // throws once the redirect is in flight; the throw stops the
    // calling pipeline.
    getAccessToken.mockResolvedValue("token");
    recoverFromHardAuthFailure.mockRejectedValue(
      new Error("loginRedirect in flight"),
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(tokenFetch("https://example.com/api/items")).rejects.toThrow(
      "loginRedirect in flight",
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(recoverFromHardAuthFailure).toHaveBeenCalledTimes(1);
  });
});
