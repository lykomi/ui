/**
 * Derive the Voice Live session from the chosen mode.
 *
 * Two settings carry the whole behavioural difference between the modes, and
 * both are documented Voice Live features rather than anything clever:
 *
 *   - `turn_detection.create_response` — "Enable or disable whether a
 *     response is generated (default: true)". `relay` sets it false, so the
 *     Voice Live model never answers; the app's AG-UI agent does, and the
 *     answer is spoken back with `pre_generated_assistant_message`.
 *   - `tools` — only `realtime` gets them, because only there is the Voice
 *     Live model the one deciding to call something.
 *
 * `input_audio_transcription` is forced on for both modes. The SDK's
 * `DEFAULT_SESSION_CONFIG` omits it, and without it no user transcript ever
 * arrives — which silently reduces `relay` to a microphone that does
 * nothing and `realtime` to an assistant-only transcript.
 */

import type {
  FunctionTool,
  Tool,
  VoiceLiveSessionConfig,
} from "@iloveagents/foundry-voice-live-react";
import type { ToolRegistry } from "@iloveagents/foundry-agent";
import type { VoiceMode } from "./types.ts";

/**
 * Transcription model. `mai-transcribe` is the Voice Live model that works
 * with every model and agent, rather than only the OpenAI-native ones.
 */
const DEFAULT_TRANSCRIPTION_MODEL = "mai-transcribe" as const;

/**
 * AG-UI tool schemas → Voice Live function tools.
 *
 * The two shapes are the same object plus a discriminator, which is the
 * point: a tool the typed chat can call is callable by voice with no second
 * declaration and no drift between them.
 */
export function toVoiceLiveTools(registry: ToolRegistry): FunctionTool[] {
  return registry.getActiveSchemas().map((schema) => ({
    type: "function",
    name: schema.name,
    description: schema.description ?? "",
    parameters: (schema.parameters ?? {}) as object,
  }));
}

export interface BuildVoiceSessionOptions {
  mode: VoiceMode;
  /** Host overrides, applied last — an explicit value always wins. */
  overrides?: VoiceLiveSessionConfig;
  /** Present only when the host opted into exposing client tools in `realtime`. */
  registry?: ToolRegistry;
}

/**
 * Build the session config for a mode.
 *
 * Precedence is deliberate and shallow-per-key: mode defaults, then host
 * overrides. `turnDetection` merges key-by-key so a host can retune VAD
 * (threshold, eagerness, filler words) without having to re-state
 * `createResponse` and silently break the mode.
 */
export function buildVoiceSession({
  mode,
  overrides,
  registry,
}: BuildVoiceSessionOptions): VoiceLiveSessionConfig {
  const isRelay = mode === "relay";

  const tools: Tool[] | undefined = registry ? toVoiceLiveTools(registry) : undefined;

  const base: VoiceLiveSessionConfig = {
    modalities: ["text", "audio"],
    inputAudioTranscription: { model: DEFAULT_TRANSCRIPTION_MODEL },
    turnDetection: {
      type: "azure_semantic_vad",
      // Barge-in, and keep the server's transcript honest about what was
      // actually heard before the interruption.
      interruptResponse: true,
      autoTruncate: true,
      createResponse: !isRelay,
    },
  };

  // An empty tool list is not the same as "no tools": sending `tools: []`
  // states there are none, which is right for relay and wrong to send when
  // the host simply did not opt in.
  if (tools !== undefined) {
    base.tools = tools;
    base.toolChoice = "auto";
  }

  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    turnDetection:
      overrides.turnDetection === undefined
        ? base.turnDetection
        : overrides.turnDetection === null
          ? null
          : { ...base.turnDetection, ...overrides.turnDetection },
  };
}
