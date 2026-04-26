/**
 * Per-service fetch factory.
 *
 * Returns an authenticated `fetch`-shaped function that:
 * 1. Rewrites local-relative URLs to a configured router base in production
 *    (Vite proxy in dev → httpRouteConfigs FQDN in prod).
 * 2. Acquires a Bearer token via the supplied `acquireToken` callback and
 *    attaches it as the `Authorization` header.
 *
 * `@lastspace/agent` stays auth-mechanism-agnostic — `acquireToken` is
 * supplied by the host (apps/web wires it to MSAL via the `/msal` subpath;
 * future shells could plug in a different token source).
 */

export interface ServiceFetchOptions {
  /**
   * Acquire an access token for outgoing requests. Return `null` to skip
   * token attachment (callers without auth — e.g. local dev — pass through
   * to native fetch).
   */
  acquireToken: () => Promise<string | null>;

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
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (!headers.has("Authorization")) {
      try {
        const token = await options.acquireToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } catch {
        // Token acquisition failed — proceed without
      }
    }

    if (input instanceof Request) {
      // Build a fresh Request against the rewritten URL, copying every
      // field the runtime exposes on the original — explicit field copy
      // is more portable than `new Request(url, originalRequest)`, which
      // some runtimes (older undici/JSDOM in particular) do not honor
      // for method/body. `init` then overrides anything the caller passed.
      const cloned = input.clone();
      const requestInit: RequestInit = {
        method: cloned.method,
        body:
          cloned.method === "GET" || cloned.method === "HEAD" ? undefined : cloned.body,
        headers,
        credentials: cloned.credentials,
        mode: cloned.mode,
        cache: cloned.cache,
        redirect: cloned.redirect,
        referrer: cloned.referrer,
        integrity: cloned.integrity,
        signal: cloned.signal,
      };
      // Streaming bodies need duplex: "half"; harmless when there's no body.
      if (cloned.body !== null) {
        (requestInit as RequestInit & { duplex?: string }).duplex = "half";
      }
      return fetch(resolvedUrl, { ...requestInit, ...init, headers });
    }
    return fetch(resolvedUrl, { ...init, headers });
  };
}
