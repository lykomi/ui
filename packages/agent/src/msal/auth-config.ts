/**
 * MSAL configuration types and PublicClientApplication singleton.
 *
 * `initializeMsal()` creates and caches the singleton PublicClientApplication.
 * `getMsalInstance()` returns null until initialization has completed.
 *
 * `@azure/msal-browser` is loaded via dynamic import so `@iloveagents/foundry-agent`
 * does not pull MSAL into bundles that don't need it.
 */

export interface MsalAuthConfig {
  clientId: string;
  authority: string; // https://login.microsoftonline.com/{tenantId}
  redirectUri: string; // window.location.origin
  apiScope: string; // api://{apiClientId}/access_as_user
  postLogoutRedirectUri?: string;
}

export interface MsalAccountInfo {
  username: string;
  localAccountId: string;
  name?: string | null;
}

export interface MsalClientApplication {
  initialize(): Promise<void>;
  handleRedirectPromise(): Promise<unknown>;
  getAllAccounts(): MsalAccountInfo[];
  loginRedirect(request: { scopes: string[]; prompt?: string }): Promise<void>;
  logoutRedirect(): Promise<void>;
  setActiveAccount(account: MsalAccountInfo | null): void;
  acquireTokenSilent(request: {
    scopes: string[];
    account: MsalAccountInfo;
  }): Promise<{ accessToken: string }>;
  acquireTokenRedirect(request: {
    scopes: string[];
    account: MsalAccountInfo;
  }): Promise<void>;
  acquireTokenPopup(request: {
    scopes: string[];
    account: MsalAccountInfo;
  }): Promise<{ accessToken: string }>;
}

let msalInstance: MsalClientApplication | null = null;
let msalConfig: MsalAuthConfig | null = null;

/**
 * Initialize the MSAL singleton. Must be called once before rendering.
 * Dynamically imports `@azure/msal-browser` so the dependency stays optional.
 */
export async function initializeMsal(
  config: MsalAuthConfig,
): Promise<MsalClientApplication> {
  if (msalInstance) return msalInstance;

  const { PublicClientApplication: PCA } = await import("@azure/msal-browser");

  // Token-renewal config — see Microsoft Learn:
  // https://learn.microsoft.com/entra/msal/javascript/browser/errors
  //
  // SPA refresh tokens are 24 h, non-sliding, non-renewable. After that
  // window the user MUST re-auth; nothing the SPA can do silently saves
  // it. Goal of these knobs is to make the unavoidable interactive
  // bounce predictable and to keep the silent path healthy in between.
  const msalConfiguration = {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.postLogoutRedirectUri ?? config.redirectUri,
    },
    cache: {
      // localStorage is required for Playwright E2E tests — sessionStorage
      // is not preserved across page navigations in the Playwright context.
      cacheLocation: "localStorage",
      // Cache key includes a hash of any `claims` parameter. Without
      // this, MSAL serves the same cached access token even after a
      // claims-challenge / token revocation / role change. The MSAL
      // team has signalled this will become the default; opt in early.
      claimsBasedCachingEnabled: true,
    },
    system: {
      // Treat access tokens as "expired" 10 min before the actual exp
      // claim instead of MSAL's default 5 min. Eliminates the race
      // where the SPA's clock thinks the token is still valid but the
      // resource server rejects it as expired (clock skew, slow request
      // queueing, etc.).
      tokenRenewalOffsetSeconds: 600,
      // Default 6 s is too tight on modern browsers — third-party
      // storage partitioning + slower CPUs in the silent iframe can
      // push the round-trip past it. 10 s is the value MSAL Angular
      // and React samples ship with.
      iframeHashTimeout: 10000,
    },
  };

  msalInstance = new (PCA as new (config: typeof msalConfiguration) => MsalClientApplication)(
    msalConfiguration,
  );
  await msalInstance.initialize();
  msalConfig = config;
  return msalInstance;
}

/** Get the MSAL instance (null when not configured). */
export function getMsalInstance(): MsalClientApplication | null {
  return msalInstance;
}

/** Get the MSAL auth config (null when not configured). */
export function getMsalConfig(): MsalAuthConfig | null {
  return msalConfig;
}
