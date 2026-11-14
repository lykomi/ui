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
import type { ToolRegistry } from "@lykomi/agent";
import type { VoiceMode } from "./types.ts";

/**
 * Transcription model. `mai-transcribe` is the Voice Live model that works
 * with every model and agent, rather than only the OpenAI-native ones.
 */
const DEFAULT_TRANSCRIPTION_MODEL = "mai-transcribe" as const;

/**
 * Green screen, so the avatar can be keyed out and sit on the app's own
 * background.
 *
 * `VoiceLiveAvatar` chroma-keys by default, but only the *session* can ask
 * Azure to render a keyable background — without this the service composites
 * the avatar onto opaque white, the chroma key finds no green, and the
 * result is a white rectangle pasted over the page.
 */
const GREEN_SCREEN = "#00FF00FF";

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

  if (!overrides) return withKeyableAvatarBackground(base);

  return withKeyableAvatarBackground({
    ...base,
    ...overrides,
    // Tools MERGE rather than replace. A host declaring an MCP server or a
    // Foundry agent tool is adding server-side capability, not withdrawing
    // the browser's — and a plain spread would silently drop every client
    // tool the moment one was declared, leaving the model unable to touch
    // the UI with no error to explain why.
    tools: sessionTools(registry, overrides.tools),
    turnDetection:
      overrides.turnDetection === undefined
        ? base.turnDetection
        : overrides.turnDetection === null
          ? null
          : { ...base.turnDetection, ...overrides.turnDetection },
  });
}

/**
 * Give a configured avatar a keyable background unless the host chose one.
 *
 * A host that wants the avatar composited on a colour or an image says so and
 * is left alone; the default is the one that composes with any theme.
 */
function withKeyableAvatarBackground(session: VoiceLiveSessionConfig): VoiceLiveSessionConfig {
  const avatar = session.avatar;
  if (!avatar || avatar.video?.background !== undefined) return session;
  return {
    ...session,
    avatar: {
      ...avatar,
      video: { ...avatar.video, background: { color: GREEN_SCREEN } },
    },
  };
}

/**
 * The tool catalogue a session carries: the registry's client tools merged
 * with whatever the host declared.
 *
 * Exported because `session.update` REPLACES the catalogue rather than adding
 * to it, so the live re-sync has to rebuild the very same list this file
 * builds at connect time. Two places deriving it independently is precisely
 * how the host's MCP tools went missing the moment a session became ready.
 */
export function sessionTools(
  registry: ToolRegistry | undefined,
  hostTools: Tool[] | undefined,
): Tool[] | undefined {
  return mergeTools(registry ? toVoiceLiveTools(registry) : undefined, hostTools);
}

/**
 * Combine the registry's function tools with whatever the host declared.
 *
 * Function tools are keyed by name so a host can deliberately override one
 * of the registry's; everything else (MCP servers, Foundry agent tools) is
 * additive, since those are distinct capabilities rather than replacements.
 */
function mergeTools(base: Tool[] | undefined, extra: Tool[] | undefined): Tool[] | undefined {
  if (!base) return extra;
  if (!extra) return base;

  const byName = new Map<string, Tool>();
  const others: Tool[] = [];
  for (const tool of [...base, ...extra]) {
    if (tool.type === "function") byName.set(tool.name, tool);
    else others.push(tool);
  }
  return [...byName.values(), ...others];
}
