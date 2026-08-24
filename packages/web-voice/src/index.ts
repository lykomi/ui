/**
 * `@iloveagents/foundry-web-voice` — spoken conversation for Foundry UI.
 *
 * Optional by construction: nothing in `@iloveagents/foundry-web-ui` imports
 * this package, and an app that never installs it has an unchanged composer
 * and an unchanged runtime.
 *
 * ```ts
 * bootstrapShell({
 *   modules: [createVoiceModule({ connection: { proxyUrl: VOICE_PROXY_URL } })],
 * });
 * ```
 */

// --- installation ---
export { createVoiceModule, type VoiceChatModule } from "./react/voice-module.tsx";
export {
  FoundryVoice,
  installVoice,
  type VoiceInstallOptions,
  type VoiceInstallation,
} from "./react/install.tsx";

// --- configuration ---
export type { VoiceConfig, VoiceMode, VoiceTranscript } from "./adapter/types.ts";

// --- chrome (place these yourself with `chrome: false`) ---
export { VoiceMicButton } from "./react/voice-mic-button.tsx";
export { VoiceStatusStrip } from "./react/voice-status-strip.tsx";
export { VoiceAvatarPanel, type VoiceAvatarPanelProps } from "./react/voice-avatar.tsx";
export { useVoiceUiStore } from "./react/voice-ui-store.ts";

// --- the pieces, for hosts that assemble their own ---
export { VoiceBridge, type VoiceTransportControls } from "./adapter/voice-bridge.ts";
export { buildVoiceSession, toVoiceLiveTools } from "./adapter/session-config.ts";
export { createRegistryToolExecutor } from "./adapter/tool-bridge.ts";
export { SentenceStream, SpeechQueue, toSpeakableText } from "./adapter/speech-queue.ts";
