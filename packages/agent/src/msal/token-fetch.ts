/**
 * Token-aware fetch wrapper.
 *
 * Acquires a Bearer token from MSAL (if configured) and attaches it to
 * every outgoing request. All requests use the API scope — the API backend
 * acts as a gateway and exchanges tokens server-side via OBO when calling
 * downstream services (e.g., Spaces).
 *
 * When MSAL is not configured, behaves identically to native `fetch()`.
 *
 * Long-lived tab recovery: on 401 the wrapper retries once with
 * ``forceRefresh: true`` so the resource server doesn't keep seeing a
 * stale-but-cached access token. See ``service-fetch.ts`` for the same
 * pattern with URL rewriting + the deeper rationale.
 */

import { authStore } from "./auth-store.ts";

export async function tokenFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  async function dispatch(forceRefreshToken: boolean): Promise<Response> {
    const token = await authStore
      .getState()
      .getAccessToken("api", forceRefreshToken ? { forceRefresh: true } : undefined);

    // Clone Request inputs per-attempt: ReadableStream bodies are single-
    // consume, so the 401 retry would otherwise see an empty body.
    // ``input.clone()`` returns a fresh Request whose body stream is
    // independent of the original.
    const target = input instanceof Request ? input.clone() : input;

    if (!token) {
      return fetch(target, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(target, { ...init, headers });
  }

  const response = await dispatch(false);
  if (response.status !== 401) {
    return response;
  }
  response.body?.cancel().catch(() => undefined);
  return dispatch(true);
}
