/**
 * MSAL configuration types and PublicClientApplication singleton.
 *
 * `initializeMsal()` creates and caches the singleton PublicClientApplication.
 * `getMsalInstance()` returns null until initialization has completed.
 *
 * `@azure/msal-browser` is loaded via dynamic import so `@lastspace/agent`
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
