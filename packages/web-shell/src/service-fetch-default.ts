import { createServiceFetch } from "@iloveagents/foundry-agent";
import { authStore } from "@iloveagents/foundry-agent/msal";

/**
 * Default agent fetch client wired to the MSAL token store and the host's
 * Vite env. Customers can build their own via `createServiceFetch` from
 * `@iloveagents/foundry-agent` if they need different acquireToken / baseUrl behavior.
 *
 * Forward the optional ``{ forceRefresh }`` argument that the fetch
 * interceptor passes on the 401 retry path. Without it, the retry would
 * still ask MSAL for a cached token and the long-lived-tab 401 loop never
 * recovers.
 */
export const defaultAgentFetch: typeof fetch = createServiceFetch({
  acquireToken: (options) => authStore.getState().getAccessToken("api", options),
  baseUrl: import.meta.env.VITE_API_BASE_URL,
});
