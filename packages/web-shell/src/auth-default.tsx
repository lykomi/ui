import type { FC, ReactNode } from "react";
import { AuthProvider } from "@lastspace/web-ui";
import type { MsalAuthConfig } from "@lastspace/agent/msal";
import type { AuthAdapter } from "./types.ts";



interface AuthConfigErrorProps {
  missingKeys: string[];
}

function AuthConfigError({ missingKeys }: AuthConfigErrorProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Authentication unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Missing required MSAL environment variables: {missingKeys.join(", ")}.
        </p>
      </div>
    </div>
  );
}

/**
 * Read MSAL configuration from Vite env. Returns the resolved config or the
 * list of missing keys. The shell renders <AuthConfigError /> when any key
 * is missing.
 */
function readMsalConfigFromEnv(): MsalAuthConfig | { missing: string[] } {
  const env = import.meta.env;
  const clientId = env.VITE_MSAL_CLIENT_ID;
  const authority = env.VITE_MSAL_AUTHORITY;
  const apiScope = env.VITE_MSAL_API_SCOPE;
  const missing = [
    !clientId ? "VITE_MSAL_CLIENT_ID" : null,
    !authority ? "VITE_MSAL_AUTHORITY" : null,
    !apiScope ? "VITE_MSAL_API_SCOPE" : null,
  ].filter((v): v is string => v !== null);
  if (missing.length > 0) return { missing };
  return {
    clientId: clientId!,
    authority: authority!,
    apiScope: apiScope!,
    redirectUri: window.location.origin,
  };
}

/**
 * Default MSAL-backed auth adapter. Reads VITE_MSAL_* from import.meta.env.
 * Customers override via `bootstrapShell({ authProvider: { Provider: ... } })`
 * for tests or non-MSAL deployments.
 */
export const defaultAuthAdapter: AuthAdapter = {
  Provider: ({ children }: { children: ReactNode }) => {
    const result = readMsalConfigFromEnv();
    if ("missing" in result) {
      return <AuthConfigError missingKeys={result.missing} />;
    }
    return <AuthProvider config={result}>{children}</AuthProvider>;
  },
};

/**
 * Tiny wrapper that picks the default or override adapter and renders it.
 * Kept as a separate component so the wrapper-order test can probe it
 * easily.
 */
export const ShellAuth: FC<{ adapter?: AuthAdapter; children: ReactNode }> = ({
  adapter,
  children,
}) => {
  const Adapter = (adapter ?? defaultAuthAdapter).Provider;
  return <Adapter>{children}</Adapter>;
};
