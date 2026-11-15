import "./index.css";
import { showcaseModule } from "./showcase/module.tsx";
import { bootstrapShell } from "@lykomi/web-shell";
import type { AuthAdapter } from "@lykomi/web-shell";
import { createVoiceModule } from "@lykomi/web-voice";
import { customerPages } from "@/pages/index.tsx";
import { graphModule } from "@/tools/graph-module.tsx";

const localDemoAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

/**
 * Voice, switched on by configuration rather than by a build flag — kept from
 * the base template, which this file replaces.
 *
 * Talking to the app needs a Voice Live proxy (a browser cannot put a
 * credential on a WebSocket), so a scaffold cannot ship one. Set
 * `VITE_VOICE_PROXY_URL` and a microphone appears in the composer; leave it
 * unset and nothing is registered, no mic is drawn, and the bundler drops the
 * package entirely.
 */
const voiceProxyUrl = import.meta.env.VITE_VOICE_PROXY_URL;
const voiceModules = voiceProxyUrl
  ? [createVoiceModule({ connection: { proxyUrl: voiceProxyUrl } })]
  : [];

bootstrapShell({
  modules: [showcaseModule, ...voiceModules, graphModule],
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
