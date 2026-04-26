import { createServiceFetch } from "@lastspace/agent";
import { authStore } from "@lastspace/agent/msal";

/**
 * Default agent fetch client wired to the MSAL token store and the host's
 * Vite env. Customers can build their own via `createServiceFetch` from
 * `@lastspace/agent` if they need different acquireToken / baseUrl behavior.
 */
export const defaultAgentFetch: typeof fetch = createServiceFetch({
  acquireToken: () => authStore.getState().getAccessToken("api"),
  baseUrl: import.meta.env.VITE_API_BASE_URL,
});
