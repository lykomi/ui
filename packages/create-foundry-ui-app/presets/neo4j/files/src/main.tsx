import "./index.css";
import { bootstrapShell } from "@iloveagents/foundry-web-shell";
import type { AuthAdapter } from "@iloveagents/foundry-web-shell";
import { customerPages } from "@/pages/index.tsx";
import { graphModule } from "@/tools/graph-module.tsx";

const localDemoAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

bootstrapShell({
  modules: [graphModule],
  pages: customerPages,
  authProvider: localDemoAuth,
  agentFetch: fetch,
  theme: [
    {
      id: "app-branding",
      definition: {
        branding: {
          appName: "Graph Explorer",
          appTitle: "Graph Explorer",
        },
      },
    },
  ],
});
