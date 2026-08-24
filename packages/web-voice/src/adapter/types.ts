/**
 * Public configuration for the voice tier.
 *
 * Connection and session shapes are re-used from the Voice Live SDK rather
 * than re-declared, so there is exactly one source of truth for what Azure
 * accepts and a new SDK field needs no change here.
 */

import type {
  ChromaKeyConfig,
  LogLevel,
  ReconnectOptions,
  VoiceLiveConnectionConfig,
  VoiceLiveSessionConfig,
} from "@iloveagents/foundry-voice-live-react";

/**
 * Who answers a spoken question.
 *
 * - ``relay`` (default) — Voice Live is ears and mouth only. The final
 *   transcript is submitted to the composer, so the app's own AG-UI agent
 *   answers with its full tool/retrieval surface, and the answer is spoken
 *   back. Turns are ordinary thread turns: they render with tool cards and
 *   citations, and they persist through whatever history adapter the host
 *   configured.
 *
 * - ``realtime`` — the Voice Live model answers directly. Sub-second, and
 *   it can call the app's client-side tools, but it only knows what those
 *   tools tell it. Its turns are live-session-scoped: assistant-ui merges
 *   them into the thread while connected and drops them on disconnect
 *   (`BaseThreadRuntimeCore.disconnectVoice` clears `_voiceMessages`), so
 *   they never reach a history adapter. Use `onTranscript` to persist them
 *   yourself if you need to.
 */
export type VoiceMode = "relay" | "realtime";

/** A transcript line as it arrives; `text` is cumulative for a given turn. */
export interface VoiceTranscript {
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}

export interface VoiceConfig {
  /** @default "relay" */
  mode?: VoiceMode;

  /**
   * How to reach Voice Live. In production this is `{ proxyUrl }`: a
   * browser cannot set an `Authorization` header on a WebSocket, so the
   * credential belongs in a proxy, never in the bundle.
   */
  connection: VoiceLiveConnectionConfig;

  /**
   * Session options — voice, avatar, instructions, VAD tuning. Merged over
   * the defaults this package derives from `mode`; anything you set here
   * wins, including the fields the mode would otherwise choose.
   */
  session?: VoiceLiveSessionConfig;

  /**
   * Expose the app's client-side tools (`ui_*`, `page_*`) to the voice
   * model. `realtime` only — in `relay` mode the AG-UI agent owns tools and
   * this is ignored.
   * @default true
   */
  exposeClientTools?: boolean;

  /**
   * Mute the microphone while the assistant is speaking.
   *
   * On a laptop's speakers the assistant hears itself: its own voice trips
   * the service's VAD, which commits a turn, which produces another reply —
   * a conversation the user is no longer part of. Server echo cancellation
   * removes most of it, not all, and an avatar's audio arrives over WebRTC
   * where it helps least.
   *
   * The cost is barge-in: a muted microphone cannot interrupt. Leave it off
   * when users wear headsets; turn it on for demos and speakerphone rooms.
   *
   * @default false
   */
  halfDuplex?: boolean;

  /**
   * Chroma-key tuning for the avatar's green-screen removal.
   *
   * The default is slightly softer-edged than the SDK's, because the stock
   * values left a visible green fringe on the avatar's outline against
   * light and dark surfaces alike. Raise `similarity` if green spill
   * remains; lower it if the avatar's own dark clothing starts to key out.
   */
  chromaKey?: ChromaKeyConfig;

  /** Console verbosity of the underlying SDK. @default "warn" */
  logLevel?: LogLevel;

  /** Auto-reconnect after an unexpected control-channel close. @default false */
  reconnect?: boolean | Partial<ReconnectOptions>;

  /**
   * Every transcript line, both roles. The hook into persistence for
   * `realtime` turns, which assistant-ui deliberately keeps ephemeral.
   */
  onTranscript?: (transcript: VoiceTranscript) => void;

  /** Session-fatal errors, already surfaced to the runtime as an ended session. */
  onError?: (message: string) => void;
}
