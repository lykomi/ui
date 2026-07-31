/**
 * Per-service fetch factory.
 *
 * Returns an authenticated `fetch`-shaped function that:
 * 1. Rewrites local-relative URLs to a configured router base in production
 *    (Vite proxy in dev → httpRouteConfigs FQDN in prod).
 * 2. Acquires a Bearer token via the supplied `acquireToken` callback and
 *    attaches it as the `Authorization` header.
 *
 * `@iloveagents/foundry-agent` stays auth-mechanism-agnostic — `acquireToken` is
 * supplied by the host (apps/web wires it to MSAL via the `/msal` subpath;
 * future shells could plug in a different token source).
 */

export interface ServiceFetchOptions {
  /**
   * Acquire an access token for outgoing requests. Return `null` to skip
   * token attachment (callers without auth — e.g. local dev — pass through
   * to native fetch).
   *
   * The optional ``{ forceRefresh: true }`` argument is passed by the
   * fetch interceptor on a 401 retry — the auth layer should bypass
   * its local token cache and round-trip the token endpoint so we
   * stop re-sending an access token the resource server has already
   * rejected (canonical MSAL.js fix for tab-open-overnight 401 loops).
   */
  acquireToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;

  /**
   * Force interactive recovery (e.g. ``loginRedirect``) when even a
   * force-refreshed access token gets rejected by the resource server.
   * The fetch interceptor calls this after a SECOND consecutive 401 —
   * at that point we know the silent refresh produced a token the
   * server still won't accept (audience drift, conditional-access
   * re-eval, tenant-policy change), and the only correct UX is to
   * mint a fresh session.
   *
   * Implementations should clear cached auth state and start a redirect
   * to the IdP. They MUST throw rather than return so the fetch caller
   * can stop processing the in-flight request — when this resolves
   * normally the redirect is in flight and the page is about to
   * navigate away.
   *
   * Optional: when omitted, the fetch interceptor lets the second 401
   * propagate as-is. Hosts without an interactive recovery path (e.g.
   * tests, embedded apps) should leave it unset.
   */
  recoverFromHardAuthFailure?: (reason: unknown) => Promise<never>;

  /**
   * Router FQDN for production (e.g. `https://api.example.com`).
   * Empty / undefined leaves the URL untouched (Vite proxy handles routing
   * in dev).
   */
  baseUrl?: string;

  /**
   * Resolve `window.location.origin` (or equivalent) for the current runtime.
   * Defaults to a browser-aware lookup; non-browser callers can override.
   */
  originResolver?: () => string;
}

export type ServiceFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Wrapper thrown when ``acquireToken`` rejects inside the fetch
 * interceptor. Lets the outer 401-retry layer distinguish
 * token-acquisition failures (which warrant interactive recovery) from
 * generic ``fetch`` rejections like network drops, aborts, or CORS
 * preflight failures (which do NOT — those would needlessly bounce the
 * user through ``loginRedirect`` on a transient transport error).
 *
 * Exported so hosts that wrap ``serviceFetch`` further can ``instanceof``
 * against the same class without re-declaring it.
 */
export class TokenAcquisitionError extends Error {
  override readonly name = "TokenAcquisitionError";
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.cause = cause;
  }
}

const defaultOriginResolver = (): string =>
  typeof window !== "undefined" ? window.location.origin : "";

/**
 * Build a service-fetch function. Returns a function with the same shape as
 * `fetch` that rewrites URLs + attaches the Bearer token from `acquireToken`.
 */
export function createServiceFetch(options: ServiceFetchOptions): ServiceFetch {
  const routerBase = (options.baseUrl ?? "").replace(/\/+$/, "");
  const resolveOrigin = options.originResolver ?? defaultOriginResolver;

  function resolveUrl(url: string): string {
    if (!routerBase) return url; // dev: Vite proxy handles routing
    const origin = resolveOrigin();
    const rel = origin && url.startsWith(origin) ? url.slice(origin.length) : url;
    return `${routerBase}${rel}`;
  }

  return async function serviceFetch(input, init): Promise<Response> {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const resolvedUrl = resolveUrl(url);

    // Merge headers from a `Request` input (if provided), then `init`. The
    // Request-input branch must preserve method / body / credentials /
    // signal / etc. — silently dropping them by reading only `.url` would
    // turn POST/PUT into GET and drop required headers.
    const baseHeaders = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => baseHeaders.set(key, value));
    }
    const callerSuppliedAuth = baseHeaders.has("Authorization");

    function buildRequestInitFrom(req: Request): RequestInit {
      // ReadableStream bodies are single-consume. ``req.clone()`` returns a
      // fresh Request whose body stream is independent — call it once per
      // dispatch attempt so the 401 retry can replay POST/PUT bodies
      // intact.
      const fresh = req.clone();
      const ri: RequestInit = {
        method: fresh.method,
        body: fresh.method === "GET" || fresh.method === "HEAD" ? undefined : fresh.body,
        credentials: fresh.credentials,
        mode: fresh.mode,
        cache: fresh.cache,
        redirect: fresh.redirect,
        referrer: fresh.referrer,
        integrity: fresh.integrity,
        signal: fresh.signal,
      };
      // Streaming bodies need duplex: "half"; harmless when there's no body.
      if (fresh.body !== null) {
        (ri as RequestInit & { duplex?: string }).duplex = "half";
      }
      return ri;
    }

    async function dispatch(forceRefreshToken: boolean): Promise<Response> {
      const headers = new Headers(baseHeaders);
      if (!callerSuppliedAuth) {
        try {
          const token = await options.acquireToken(
            forceRefreshToken ? { forceRefresh: true } : undefined,
          );
          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
          }
        } catch (error) {
          // A thrown token-acquisition error usually means the auth layer
          // is starting an interactive recovery. Do not downgrade
          // protected API calls to anonymous requests; that creates
          // noisy 401s and stale UI. Wrap the error so the outer
          // 401-retry layer can distinguish it from generic ``fetch``
          // rejections (network drops, aborts, CORS preflight fails)
          // and only escalate to ``recoverFromHardAuthFailure`` for
          // genuine auth failures.
          throw new TokenAcquisitionError(error);
        }
      }
      if (input instanceof Request) {
        // Re-clone for THIS attempt — the body stream of the original is
        // either still pristine (first attempt) or already consumed
        // (second attempt); ``clone()`` always returns a fresh, replayable
        // copy.
        const requestInit = buildRequestInitFrom(input);
        return fetch(resolvedUrl, { ...requestInit, ...init, headers });
      }
      return fetch(resolvedUrl, { ...init, headers });
    }

    const response = await dispatch(false);

    // Long-lived tab recovery: when the resource server returns 401 the
    // local MSAL cache may still hold a token MSAL itself thinks is valid
    // (claims challenge, conditional-access re-eval, audience drift, or
    // the user simply left the tab open past the cached access token's
    // server-side validity). Force-refresh the token via the refresh
    // token grant and replay the request once. If the refresh-token is
    // also gone (24h SPA cap), ``acquireToken`` will throw an
    // interaction-required error and the auth layer kicks off
    // ``loginRedirect`` — that's the only correct UX for a hard expiry.
    //
    // Conditions for retry: 401, no caller-supplied auth header (we own
    // the token), and the server didn't already see a fresh token (we
    // only retry once).
    if (response.status !== 401 || callerSuppliedAuth) {
      return response;
    }
    // Drain the failed response body — letting it sit unread keeps the
    // underlying connection occupied on some runtimes.
    response.body?.cancel().catch(() => undefined);

    // Two failure shapes for the retry:
    //   (a) The force-refreshed token grant FAILS — refresh token gone
    //       (24h SPA cap), interaction-required claims challenge, etc.
    //       ``acquireToken`` throws inside ``dispatch`` BEFORE the fetch
    //       leaves the browser. ``dispatch`` re-throws wrapped in
    //       ``TokenAcquisitionError`` so we can distinguish this case
    //       from network errors below.
    //   (b) The grant succeeds but the resource server STILL rejects
    //       the token (audience drift, server-side policy change). The
    //       retried response status is 401.
    // Both must funnel into ``recoverFromHardAuthFailure`` so the auth
    // layer can kick off ``loginRedirect`` — the only correct UX for a
    // hard expiry. We treat the two auth paths symmetrically.
    //
    // We deliberately do NOT trigger recovery on generic ``dispatch``
    // throws (TypeError from network drops, AbortError from caller
    // cancellation, CORS-preflight failures, etc.) — those are
    // transient transport problems, not auth state corruption, and
    // bouncing the user through ``loginRedirect`` for a flaky network
    // would be a much worse UX than letting the error propagate.
    let retried: Response;
    try {
      retried = await dispatch(true);
    } catch (err) {
      if (err instanceof TokenAcquisitionError && options.recoverFromHardAuthFailure) {
        // ``recoverFromHardAuthFailure`` is expected to throw once the
        // redirect is in flight; if it returns (e.g. test stub) we
        // re-throw the wrapped original so the caller still sees the
        // auth failure rather than a phantom recovery. We pass the
        // unwrapped ``cause`` to recovery so it sees the real MSAL
        // error (InteractionRequiredAuthError etc.) for telemetry.
        await options.recoverFromHardAuthFailure(err.cause);
      }
      throw err;
    }

    // Hard auth failure path (b): even the force-refreshed token got
    // rejected. A token minted from the cached refresh token carries
    // the same identity claims as the original, so it'll keep getting
    // rejected for the same reason. Only a brand-new ``loginRedirect``
    // produces a token bound to the current server policy. Without
    // this branch the user sees an endless 401 loop until they
    // manually log out.
    if (retried.status === 401 && options.recoverFromHardAuthFailure) {
      // Continuous Access Evaluation / Conditional-Access claims
      // challenge passthrough. When the resource server requires a
      // step-up (MFA, device compliance, revocation invalidation),
      // it returns 401 with ``WWW-Authenticate: Bearer ... claims="…"``.
      // We forward the payload through the recovery callback so the
      // auth layer's redirect carries it to Entra ID and the
      // re-minted token satisfies the exact challenge. Without it,
      // Entra re-issues the same already-rejected claims set and the
      // user loops back into the broken state.
      const claims = parseClaimsChallengeFromWwwAuthenticate(
        retried.headers.get("www-authenticate"),
      );
      retried.body?.cancel().catch(() => undefined);
      const reason = new AuthInteractionRequiredError(
        "API returned 401 after force-refresh retry",
        claims ? { claims } : undefined,
      );
      // ``recoverFromHardAuthFailure`` throws once the redirect is in
      // flight; the throw stops the calling pipeline so we don't
      // return a stale 401 the caller might handle as a real failure.
      await options.recoverFromHardAuthFailure(reason);
    }
    return retried;
  };
}

/**
 * Error class the fetch interceptor raises (and forwards through
 * ``recoverFromHardAuthFailure``) when a 401 needs interactive
 * recovery. Exposed so the auth-layer recovery can pick up a
 * ``claims`` field if one was extracted from the
 * ``WWW-Authenticate`` header.
 */
export class AuthInteractionRequiredError extends Error {
  override readonly name = "AuthInteractionRequiredError";
  readonly claims?: string;
  constructor(message: string, options?: { claims?: string }) {
    super(message);
    this.claims = options?.claims;
  }
}

/**
 * Extract the claims challenge string from a resource server's
 * ``WWW-Authenticate: Bearer ... claims="…"`` header. Returns
 * ``undefined`` when the header is missing, malformed, or carries
 * no claims directive.
 *
 * The value is forwarded VERBATIM to MSAL's
 * ``acquireTokenRedirect({ claims })``; MSAL handles the
 * base64-url decode + JSON parse itself. We don't try to validate
 * the inner shape — letting Entra speak for itself avoids drift if
 * the schema evolves.
 *
 * Spec: RFC 6750 ``WWW-Authenticate`` + CAE claims-challenge
 * supplement (Microsoft Identity Platform docs).
 */
export function parseClaimsChallengeFromWwwAuthenticate(
  header: string | null | undefined,
): string | undefined {
  if (!header) return undefined;
  // ``WWW-Authenticate`` can carry multiple challenges separated by
  // commas (e.g. ``Basic realm="x", Bearer ...``). We only care
  // about the Bearer challenge.
  const bearer = header.match(/Bearer\s+([^,]+(?:,(?!\s*[A-Za-z]+\s)[^,]*)*)/i);
  if (!bearer) return undefined;
  // Inside the Bearer params, find ``claims="..."`` (quoted) or
  // ``claims=token68`` (unquoted, base64url).
  const quoted = bearer[1].match(/claims\s*=\s*"([^"]*)"/i);
  if (quoted) return quoted[1].length > 0 ? quoted[1] : undefined;
  const unquoted = bearer[1].match(/claims\s*=\s*([A-Za-z0-9_\-+/=]+)/i);
  if (unquoted) return unquoted[1].length > 0 ? unquoted[1] : undefined;
  return undefined;
}
