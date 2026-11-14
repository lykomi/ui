import "./index.css";
import { bootstrapShell } from "@lykomi/web-shell";
import type { AuthAdapter } from "@lykomi/web-shell";
import { customerPages } from "@/pages/index.tsx";
import { foundryIqModule } from "@/tools/foundry-iq-module.tsx";

const localDemoAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

bootstrapShell({
  modules: [foundryIqModule],
  pages: customerPages,
  authProvider: localDemoAuth,
  agentFetch: fetch,
  theme: [
    {
      id: "app-branding",
      definition: {
        branding: {
          appName: "LYKOMI UI",
          appTitle: "LYKOMI UI",
        },
      },
    },
  ],
});
