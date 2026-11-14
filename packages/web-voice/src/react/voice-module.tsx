/**
 * `createVoiceModule` — the voice tier as a `bootstrapShell` module.
 *
 * The returned object is structurally a `ChatModule`. It is typed locally
 * rather than imported from `@lykomi/web-shell` on purpose: the
 * shell composes modules, so a module importing the shell would invert the
 * dependency and make every voice consumer install the shell — including the
 * ones that build their own runtime. Only the three fields this module
 * actually populates are declared.
 */

import type { ReactNode } from "react";
import { installVoice, type VoiceInstallOptions } from "./install.tsx";

/** The slice of `web-shell`'s `ChatModule` contract this module fills. */
export interface VoiceChatModule {
  name: string;
  layoutExtras?: ReactNode;
}

/**
 * ```ts
 * bootstrapShell({
 *   modules: [
 *     createVoiceModule({
 *       connection: { proxyUrl: import.meta.env.VITE_VOICE_PROXY_URL },
 *       session: sessionConfig().voice("en-US-AvaMultilingualNeural").build(),
 *     }),
 *   ],
 * });
 * ```
 *
 * Call it once, at module scope, next to the other modules — the voice
 * adapter is registered as a side effect of the call, before the runtime
 * first mounts.
 */
export function createVoiceModule(options: VoiceInstallOptions): VoiceChatModule {
  const { Host } = installVoice(options);
  return {
    name: "foundry-voice",
    layoutExtras: <Host />,
  };
}
