/**
 * AuthProvider — wraps the app with MSAL authentication.
 *
 * Uses MsalProvider's built-in redirect handling (no manual handleRedirectPromise).
 * AuthGuard uses useMsal() + inProgress to avoid redirect loops.
 *
 * The provider expects a fully resolved MSAL configuration.
 * Missing configuration is treated as an application bootstrap error.
 */

import { type FC, type PropsWithChildren, type ReactNode, useEffect, useState } from "react";
import {
  authStore,
  initializeMsal,
  getMsalInstance,
  type MsalAuthConfig,
  type MsalClientApplication,
} from "@lykomi/agent/msal";

interface AuthProviderProps {
  config: MsalAuthConfig;
}

type MsalProviderComponent = FC<{
  instance: MsalClientApplication;
  children: ReactNode;
}>;

// Dynamic imports for MSAL React (stays optional)
type MsalHook = () => {
  instance: MsalClientApplication;
  accounts: { name?: string; username: string; localAccountId: string }[];
  inProgress: string;
};

export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ config, children }) => {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [MsalProvider, setMsalProvider] = useState<MsalProviderComponent | null>(null);
  const [useMsalHook, setUseMsalHook] = useState<MsalHook | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initializeMsal(config);
        const msalReact = await import("@azure/msal-react");

        if (cancelled) return;

        setMsalProvider(() => msalReact.MsalProvider as unknown as MsalProviderComponent);
        setUseMsalHook(() => msalReact.useMsal as unknown as MsalHook);
        setReady(true);
      } catch (error) {
        console.error("[auth] Failed to initialize MSAL", error);
        if (cancelled) return;
        setInitError(
          error instanceof Error ? error.message : "Failed to initialize authentication.",
        );
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config]);

  if (!ready) return null;

  if (initError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
          <h1 className="text-lg font-semibold text-heading">Authentication unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{initError}</p>
        </div>
      </div>
    );
  }

  if (!MsalProvider || !useMsalHook) {
    return null;
  }

  const instance = getMsalInstance()!;

  return (
    <MsalProvider instance={instance}>
      <AuthGuard useMsalHook={useMsalHook}>{children}</AuthGuard>
    </MsalProvider>
  );
};

/**
 * AuthGuard — waits for MsalProvider to finish processing redirects,
 * then either syncs the account or triggers loginRedirect.
 *
 * Uses inProgress === "none" to avoid redirect loops (best practice from
 * Microsoft docs — never call loginRedirect while another interaction is active).
 */
const AuthGuard: FC<PropsWithChildren<{ useMsalHook: MsalHook }>> = ({ useMsalHook, children }) => {
  const { instance, accounts, inProgress } = useMsalHook();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Wait until MsalProvider finishes processing any redirect or startup
    if (inProgress !== "none") return;

    if (accounts.length > 0) {
      const account = accounts[0];
      authStore.getState().signIn({
        name: account.name ?? account.username,
        email: account.username,
        oid: account.localAccountId,
      });
      instance.setActiveAccount(account);
      setAuthenticated(true);
    } else {
      // No account and no interaction in progress — redirect to login.
      // Only request OIDC scopes here. API/SPACES tokens are acquired
      // silently later via acquireTokenSilent (consent is per-resource
      // in Entra ID — including them here would show N consent screens).
      instance.loginRedirect({
        scopes: ["openid", "profile", "email"],
      });
    }
  }, [instance, accounts, inProgress]);

  if (!authenticated) return null;

  return <>{children}</>;
};
