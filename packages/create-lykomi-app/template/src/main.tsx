import "./index.css";
import { bootstrapShell } from "@lykomi/web-shell";
import type { AuthAdapter } from "@lykomi/web-shell";
import { createVoiceModule } from "@lykomi/web-voice";
import { customerPages } from "@/pages/index.tsx";

const localDemoAuth: AuthAdapter = {
  Provider: ({ children }) => <>{children}</>,
};

/**
 * Voice, switched on by configuration rather than by a build flag.
 *
 * Talking to the app needs a Voice Live proxy — a browser cannot put a
 * credential on a WebSocket — so a scaffold cannot have one out of the box.
 * Set `VITE_VOICE_PROXY_URL` and a microphone appears in the composer; leave
 * it unset and nothing is registered, no mic is drawn, and the app is exactly
 * what it was before.
 *
 * The default mode is `relay`: Voice Live transcribes the user and speaks the
 * reply, while YOUR agent still answers, so spoken turns keep the tools,
 * retrieval and history that typed ones have. See the README.
 */
const voiceProxyUrl = import.meta.env.VITE_VOICE_PROXY_URL;
const voiceModules = voiceProxyUrl
  ? [createVoiceModule({ connection: { proxyUrl: voiceProxyUrl } })]
  : [];

bootstrapShell({
  modules: [...voiceModules], // Add your own ChatModules here.
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
