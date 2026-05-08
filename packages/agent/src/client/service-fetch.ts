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
   * Router FQDN for production (e.g. `https://lastspace-prod.eastus2.example.com`).
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

export type ServiceFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

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
          // A thrown token acquisition error usually means the auth layer
          // is starting an interactive recovery. Do not downgrade protected
          // API calls to anonymous requests; that creates noisy 401s and
          // stale UI.
          throw error;
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
    const retried = await dispatch(true);

    // Hard auth failure: even the force-refreshed token got rejected.
    // The silent path can't recover this — a token minted from the
    // cached refresh token carries the same identity claims as the
    // original, so it'll keep getting rejected for the same reason
    // (audience drift, conditional-access re-eval, claims challenge,
    // tenant-policy change). Only a brand-new ``loginRedirect`` produces
    // a token bound to the current server policy. Without this branch
    // the user sees an endless 401 loop until they manually log out.
    if (retried.status === 401 && options.recoverFromHardAuthFailure) {
      retried.body?.cancel().catch(() => undefined);
      // ``recoverFromHardAuthFailure`` throws once the redirect is in
      // flight; the throw stops the calling pipeline so we don't
      // return a stale 401 the caller might handle as a real failure.
      await options.recoverFromHardAuthFailure(
        new Error("API returned 401 after force-refresh retry"),
      );
    }
    return retried;
  };
}
