import type { FC, ReactNode } from "react";
import { AuthProvider } from "@lykomi/web-ui";
import type { MsalAuthConfig } from "@lykomi/agent/msal";
import type { AuthAdapter } from "./types.ts";
import { runtimeConfig } from "./runtime-config.ts";

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
 * Read MSAL configuration. Prefers runtime config (`window.__APP_CONFIG__`,
 * injected by the container at startup) and falls back to build-time Vite env
 * (`import.meta.env`) for local dev — see {@link runtimeConfig}. Returns the
 * resolved config or the list of missing keys; the shell renders
 * <AuthConfigError /> when any key is missing.
 */
function readMsalConfig(): MsalAuthConfig | { missing: string[] } {
  const clientId = runtimeConfig("VITE_MSAL_CLIENT_ID");
  const authority = runtimeConfig("VITE_MSAL_AUTHORITY");
  const apiScope = runtimeConfig("VITE_MSAL_API_SCOPE");
  const missing = [
    !clientId ? "VITE_MSAL_CLIENT_ID" : null,
    !authority ? "VITE_MSAL_AUTHORITY" : null,
    !apiScope ? "VITE_MSAL_API_SCOPE" : null,
  ].filter((v): v is string => v !== null);
  if (missing.length > 0) return { missing };
  return {
    clientId,
    authority,
    apiScope,
    redirectUri: window.location.origin,
  };
}

/**
 * Default MSAL-backed auth adapter. Reads VITE_MSAL_* from runtime config
 * (`window.__APP_CONFIG__`) with `import.meta.env` fallback for local dev.
 * Customers override via `bootstrapShell({ authProvider: { Provider: ... } })`
 * for tests or non-MSAL deployments.
 */
export const defaultAuthAdapter: AuthAdapter = {
  Provider: ({ children }: { children: ReactNode }) => {
    const result = readMsalConfig();
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
