import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceFetch,
  parseClaimsChallengeFromWwwAuthenticate,
} from "../client/service-fetch.ts";

describe("createServiceFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches Bearer token from acquireToken", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/spaces/entities");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("skips token attachment when acquireToken returns null", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("skips token attachment when Authorization header already present", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities", {
      headers: { Authorization: "Bearer pre-existing" },
    });

    expect(acquireToken).not.toHaveBeenCalled();
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer pre-existing");
  });

  it("rewrites local-relative URLs to baseUrl when configured", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com",
    });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("strips origin prefix before applying baseUrl", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com",
      originResolver: () => "https://app.example.com",
    });

    await serviceFetch("https://app.example.com/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("leaves URL untouched when baseUrl is empty (dev mode)", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/spaces/entities");
  });

  it("strips trailing slashes from baseUrl", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({
      acquireToken,
      baseUrl: "https://api.example.com//",
    });

    await serviceFetch("/api/spaces/entities");

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/spaces/entities");
  });

  it("passes URL objects through correctly", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    await serviceFetch(new URL("https://example.com/api/items"));

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/api/items");
  });

  it("preserves Request method/body/headers when input is a Request", async () => {
    const acquireToken = vi.fn().mockResolvedValue("test-token");
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Custom": "from-request" },
      body: JSON.stringify({ ok: true }),
    });

    await serviceFetch(req);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/api/items");
    expect(init?.method).toBe("POST");

    // Body is preserved (as a stream or buffer in the runtime).
    expect(init?.body).toBeDefined();

    const merged = new Headers(init?.headers);
    expect(merged.get("Authorization")).toBe("Bearer test-token");
    expect(merged.get("X-Custom")).toBe("from-request");
    expect(merged.get("Content-Type")).toBe("application/json");
  });

  it("does not attach a body for GET Requests", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      method: "GET",
      headers: { "X-Custom": "from-request" },
    });

    await serviceFetch(req);

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("init headers override Request headers when both supplied", async () => {
    const acquireToken = vi.fn().mockResolvedValue(null);
    const serviceFetch = createServiceFetch({ acquireToken });

    const req = new Request("https://example.com/api/items", {
      headers: { "X-Override": "from-request", "X-Request-Only": "req" },
    });

    await serviceFetch(req, { headers: { "X-Override": "from-init", "X-Init-Only": "init" } });

    const [, init] = fetchSpy.mock.calls[0]!;
    const merged = new Headers(init?.headers);
    expect(merged.get("X-Override")).toBe("from-init");
    expect(merged.get("X-Request-Only")).toBe("req");
    expect(merged.get("X-Init-Only")).toBe("init");
  });

  it("does not downgrade token failures to anonymous protected calls", async () => {
    const acquireToken = vi.fn().mockRejectedValue(new Error("token boom"));
    const serviceFetch = createServiceFetch({ acquireToken });

    await expect(serviceFetch("/api/spaces/entities")).rejects.toThrow("token boom");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe("401 retry with forceRefresh", () => {
    it("retries once with forceRefresh when first attempt returns 401", async () => {
      // Resource server rejects the first (stale-cached) token, then accepts
      // the freshly-acquired one. This is the long-lived-tab recovery path.
      fetchSpy.mockReset();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const acquireToken = vi
        .fn()
        .mockResolvedValueOnce("stale-token")
        .mockResolvedValueOnce("fresh-token");
      const serviceFetch = createServiceFetch({ acquireToken });

      const res = await serviceFetch("/api/spaces/entities");

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(acquireToken).toHaveBeenCalledTimes(2);
      // First call: no forceRefresh (use cached token)
      expect(acquireToken).toHaveBeenNthCalledWith(1, undefined);
      // Second call: forceRefresh: true (skip MSAL cache, hit token endpoint)
      expect(acquireToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });

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
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      const acquireToken = vi.fn().mockResolvedValue("token");
      const serviceFetch = createServiceFetch({ acquireToken });

      const res = await serviceFetch("/api/spaces/entities");

      expect(res.status).toBe(500);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(acquireToken).toHaveBeenCalledTimes(1);
    });

    it("does not retry when caller supplied their own Authorization header", async () => {
      // The caller owns the token in this case; retrying would let our auth
      // layer overwrite their explicit header on the second attempt.
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
      const acquireToken = vi.fn();
      const serviceFetch = createServiceFetch({ acquireToken });

      const res = await serviceFetch("/api/spaces/entities", {
        headers: { Authorization: "Bearer caller-supplied" },
      });

      expect(res.status).toBe(401);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(acquireToken).not.toHaveBeenCalled();
    });

    it("preserves a POST body across the 401 retry", async () => {
      // Regression for the body-stream-consumed bug: ReadableStream bodies
      // are single-consume, so the retry would otherwise see an empty body
      // and a server-side validation failure that masks the real auth
      // recovery. We assert the second attempt receives the same body.
      fetchSpy.mockReset();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const acquireToken = vi
        .fn()
        .mockResolvedValueOnce("stale-token")
        .mockResolvedValueOnce("fresh-token");
      const serviceFetch = createServiceFetch({ acquireToken });

      const payload = JSON.stringify({ name: "create-this", id: 42 });
      const request = new Request("https://example.com/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      const res = await serviceFetch(request);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Each fetch call's body must be readable and equal to the original.
      // Awaiting both confirms neither call's body stream was already
      // drained by the time fetch received it.
      const firstAttempt = fetchSpy.mock.calls[0]![1];
      const secondAttempt = fetchSpy.mock.calls[1]![1];
      const firstBody = await new Response(firstAttempt?.body as BodyInit).text();
      const secondBody = await new Response(secondAttempt?.body as BodyInit).text();
      expect(firstBody).toBe(payload);
      expect(secondBody).toBe(payload);
    });

    it("only retries once even if the second attempt also returns 401", async () => {
      // Hard auth failure (refresh token expired). With no
      // ``recoverFromHardAuthFailure`` configured, the second 401
      // propagates to the caller. (Tests cover the recovery path
      // separately below.)
      fetchSpy.mockReset();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 }));
      const acquireToken = vi.fn().mockResolvedValue("token");
      const serviceFetch = createServiceFetch({ acquireToken });

      const res = await serviceFetch("/api/spaces/entities");

      expect(res.status).toBe(401);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(acquireToken).toHaveBeenCalledTimes(2);
    });

    it("kicks off interactive recovery after a second 401", async () => {
      // Server-policy drift: even the force-refreshed token is rejected.
      // The fetch interceptor must escalate to loginRedirect via the
      // recoverFromHardAuthFailure callback — without it the user is
      // stuck in a silent 401 loop forever (the bug this fix exists for).
      fetchSpy.mockReset();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 }));
      const acquireToken = vi
        .fn()
        .mockResolvedValueOnce("stale-token")
        .mockResolvedValueOnce("force-refreshed-but-still-bad-token");
      const recoverFromHardAuthFailure = vi
        .fn()
        .mockRejectedValue(new Error("loginRedirect in flight"));
      const serviceFetch = createServiceFetch({
        acquireToken,
        recoverFromHardAuthFailure,
      });

      await expect(serviceFetch("/api/spaces/entities")).rejects.toThrow(
        "loginRedirect in flight",
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(acquireToken).toHaveBeenCalledTimes(2);
      expect(recoverFromHardAuthFailure).toHaveBeenCalledTimes(1);
      // Reason carries enough context to log/alert without leaking tokens.
      const reason = recoverFromHardAuthFailure.mock.calls[0]![0];
      expect(reason).toBeInstanceOf(Error);
      expect((reason as Error).message).toMatch(/401/);
    });

    it("does NOT call recoverFromHardAuthFailure on first-attempt success", async () => {
      // Sanity: when the first request succeeds, recovery callback must
      // never fire.
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
      const acquireToken = vi.fn().mockResolvedValue("good-token");
      const recoverFromHardAuthFailure = vi.fn();
      const serviceFetch = createServiceFetch({
        acquireToken,
        recoverFromHardAuthFailure,
      });

      const res = await serviceFetch("/api/spaces/entities");
      expect(res.status).toBe(200);
      expect(recoverFromHardAuthFailure).not.toHaveBeenCalled();
    });

    it("kicks off interactive recovery when acquireToken throws on retry", async () => {
      // Hard expiry path: refresh-token window closed (24h SPA cap) or
      // claims challenge pending. The force-refresh retry's
      // ``acquireToken`` rejects BEFORE the second fetch leaves the
      // browser. Without this branch the throw bubbles up to callers
      // that have bare ``catch {}`` (e.g. useContentTreeStore.fetchSchemas)
      // and the user is stuck in a silent 401 loop with no re-auth UI.
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
      const msalError = new Error("InteractionRequiredAuthError: refresh token expired");
      const acquireToken = vi
        .fn()
        .mockResolvedValueOnce("stale-token")
        .mockRejectedValueOnce(msalError);
      const recoverFromHardAuthFailure = vi
        .fn()
        .mockRejectedValue(new Error("loginRedirect in flight"));
      const serviceFetch = createServiceFetch({
        acquireToken,
        recoverFromHardAuthFailure,
      });

      // The wrapped TokenAcquisitionError propagates as the thrown
      // error; recovery has already kicked off by then.
      await expect(serviceFetch("/api/spaces/entities")).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // second fetch never left
      expect(acquireToken).toHaveBeenCalledTimes(2);
      expect(recoverFromHardAuthFailure).toHaveBeenCalledTimes(1);
      // Recovery receives the ORIGINAL MSAL error, not the wrapper —
      // telemetry / logging downstream should see the real cause.
      expect(recoverFromHardAuthFailure.mock.calls[0]![0]).toBe(msalError);
    });

    it("does NOT call recoverFromHardAuthFailure on transport errors during retry", async () => {
      // Regression for review feedback on PR #30: the retry-catch must
      // distinguish auth failures (TokenAcquisitionError) from
      // generic transport failures (network drop, AbortError, CORS
      // preflight reject). The latter must NOT trigger loginRedirect
      // — that would bounce users through Entra ID on any flaky-wifi
      // moment.
      fetchSpy.mockReset();
      const networkErr = new TypeError("NetworkError: Failed to fetch");
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockRejectedValueOnce(networkErr);
      const acquireToken = vi.fn().mockResolvedValue("token");
      const recoverFromHardAuthFailure = vi.fn();
      const serviceFetch = createServiceFetch({
        acquireToken,
        recoverFromHardAuthFailure,
      });

      // Network error propagates as-is; no recovery attempted.
      await expect(serviceFetch("/api/spaces/entities")).rejects.toBe(networkErr);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(acquireToken).toHaveBeenCalledTimes(2); // both attempts got a token
      expect(recoverFromHardAuthFailure).not.toHaveBeenCalled();
    });

    it("does NOT call recoverFromHardAuthFailure when the retry recovers", async () => {
      // Standard recovery — first 401, retry with forceRefresh succeeds.
      // Recovery callback must not fire (would needlessly bounce the user
      // through loginRedirect).
      fetchSpy.mockReset();
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const acquireToken = vi
        .fn()
        .mockResolvedValueOnce("stale")
        .mockResolvedValueOnce("fresh");
      const recoverFromHardAuthFailure = vi.fn();
      const serviceFetch = createServiceFetch({
        acquireToken,
        recoverFromHardAuthFailure,
      });

      const res = await serviceFetch("/api/spaces/entities");
      expect(res.status).toBe(200);
      expect(recoverFromHardAuthFailure).not.toHaveBeenCalled();
    });
  });
});

describe("parseClaimsChallengeFromWwwAuthenticate", () => {
  it("returns undefined when header is missing", () => {
    expect(parseClaimsChallengeFromWwwAuthenticate(null)).toBeUndefined();
    expect(parseClaimsChallengeFromWwwAuthenticate(undefined)).toBeUndefined();
    expect(parseClaimsChallengeFromWwwAuthenticate("")).toBeUndefined();
  });

  it("returns undefined when Bearer challenge carries no claims", () => {
    const header = 'Bearer realm="example", error="invalid_token"';
    expect(parseClaimsChallengeFromWwwAuthenticate(header)).toBeUndefined();
  });

  it("extracts quoted claims payload", () => {
    // Microsoft Identity Platform CAE / Conditional Access challenge
    // shape — base64url payload inside double quotes.
    const claims = "eyJhY2Nlc3NfdG9rZW4iOnsibmJmIjp7ImVzc2VudGlhbCI6dHJ1ZSwidmFsdWUiOiIxNjAwMDAwMDAwIn19fQ";
    const header = `Bearer realm="example", error="insufficient_claims", claims="${claims}"`;
    expect(parseClaimsChallengeFromWwwAuthenticate(header)).toBe(claims);
  });

  it("extracts unquoted token68 claims payload", () => {
    const claims = "eyJhY2Nlc3NfdG9rZW4iOnsibmJmIjp7ImVzc2VudGlhbCI6dHJ1ZX19fQ";
    const header = `Bearer claims=${claims}`;
    expect(parseClaimsChallengeFromWwwAuthenticate(header)).toBe(claims);
  });

  it("ignores non-Bearer challenges", () => {
    const header = 'Basic realm="x", Digest realm="y", claims="ignored"';
    expect(parseClaimsChallengeFromWwwAuthenticate(header)).toBeUndefined();
  });

  it("picks the Bearer claims even when other challenges are present", () => {
    const header = 'Basic realm="x", Bearer realm="api", error="insufficient_claims", claims="ABC123"';
    expect(parseClaimsChallengeFromWwwAuthenticate(header)).toBe("ABC123");
  });
});

describe("createServiceFetch — claims-challenge passthrough", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards a WWW-Authenticate claims challenge through recoverFromHardAuthFailure", async () => {
    // Resource server returned 401 with a CAE claims challenge. The
    // retry succeeds at the token level (forceRefresh produced a
    // fresh access token) but the server STILL rejects because the
    // user needs a step-up. Recovery must carry the challenge to
    // MSAL so the next token explicitly satisfies it.
    const claims = "eyJjbGFpbXMiOiJBQkMifQ";
    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer realm="api", error="insufficient_claims", claims="${claims}"`,
          },
        }),
      );
    const acquireToken = vi
      .fn()
      .mockResolvedValueOnce("stale")
      .mockResolvedValueOnce("fresh");
    const recoverFromHardAuthFailure = vi
      .fn()
      .mockRejectedValue(new Error("redirecting"));
    const serviceFetch = createServiceFetch({
      acquireToken,
      recoverFromHardAuthFailure,
    });

    await expect(serviceFetch("/api/spaces/entities")).rejects.toThrow();
    expect(recoverFromHardAuthFailure).toHaveBeenCalledTimes(1);
    const reason = recoverFromHardAuthFailure.mock.calls[0]![0];
    // Stamped onto the recovery reason so auth-store can forward it
    // to MSAL.acquireTokenRedirect({ claims }).
    expect((reason as { claims?: string }).claims).toBe(claims);
  });
});
