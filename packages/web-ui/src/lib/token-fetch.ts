/**
 * Token-aware fetch wrapper.
 *
 * Acquires a Bearer token from MSAL (if configured) and attaches it to
 * every outgoing request. All requests use the API scope — the API backend
 * acts as a gateway and exchanges tokens server-side via OBO when calling
 * downstream services (e.g., Spaces).
 *
 * When MSAL is not configured, behaves identically to native fetch().
 */

import { useAuthStore } from "./auth-store.ts";

export async function tokenFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const token = await useAuthStore.getState().getAccessToken("api");

  if (!token) {
    return fetch(input, init);
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
