import "./index.css";
import { bootstrapShell } from "@iloveagents/foundry-web-shell";
import type { AuthAdapter } from "@iloveagents/foundry-web-shell";
import { customerPages } from "@/pages/index.tsx";

const localDemoAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

bootstrapShell({
  modules: [], // Add ChatModules here.
  pages: customerPages,
  authProvider: localDemoAuth,
  agentFetch: fetch,
  theme: [
    {
      id: "app-branding",
      definition: {
        branding: {
          appName: "Foundry UI",
          appTitle: "Foundry UI",
        },
      },
    },
  ],
});
