/**
 * The composer's voice control.
 *
 * Every piece of state it reads is assistant-ui's own — `useVoiceState`,
 * `useVoiceControls`, `useVoiceVolume`, and the runtime's `voice` capability
 * flag. Nothing here talks to Voice Live, which is why the same button works
 * for any registered `RealtimeVoiceAdapter`.
 *
 * It renders nothing at all when no adapter is registered, so the composer
 * of an app without voice is unchanged.
 */

import { useAuiState, useVoiceControls, useVoiceState, useVoiceVolume } from "@assistant-ui/react";
import { TooltipIconButton } from "@iloveagents/foundry-web-ui";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { useVoiceUiStore } from "./voice-ui-store.ts";

/** Volume below which the ring is not drawn — room noise shouldn't make it shimmer. */
const RING_FLOOR = 0.05;

export function VoiceMicButton() {
  const canVoice = useAuiState((s) => s.optional.thread?.capabilities.voice ?? false);
  const voice = useVoiceState();
  const controls = useVoiceControls();
  const volume = useVoiceVolume();
  const connectionState = useVoiceUiStore((s) => s.connectionState);

  if (!canVoice) return null;

  if (!voice || voice.status.type === "ended") {
    return (
      <TooltipIconButton
        tooltip="Start voice conversation"
        variant="ghost"
        className="shrink-0"
        onClick={() => controls.connect()}
      >
        <Mic className="size-5" />
      </TooltipIconButton>
    );
  }

  if (voice.status.type === "starting") {
    return (
      <TooltipIconButton
        tooltip="Connecting…"
        variant="ghost"
        className="shrink-0"
        onClick={() => controls.disconnect()}
      >
        <Loader2 className="size-5 animate-spin" />
      </TooltipIconButton>
    );
  }

  const reconnecting = connectionState === "reconnecting";

  return (
    <span className="flex items-center gap-0.5">
      <TooltipIconButton
        tooltip={voice.isMuted ? "Unmute microphone" : "Mute microphone"}
        variant="ghost"
        className="shrink-0"
        onClick={() => (voice.isMuted ? controls.unmute() : controls.mute())}
      >
        {voice.isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </TooltipIconButton>
      <TooltipIconButton
        tooltip={reconnecting ? "Reconnecting — end voice conversation" : "End voice conversation"}
        variant="ghost"
        className="shrink-0 relative text-primary"
        onClick={() => controls.disconnect()}
      >
        {/* A ring scaled by the assistant's speaking level: the one cue that
            tells a silent-looking page apart from a wedged session. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary/15 transition-transform duration-75"
          style={{ transform: `scale(${volume > RING_FLOOR ? 1 + volume * 0.35 : 0})` }}
        />
        <PhoneOff className={`size-5 relative ${reconnecting ? "animate-pulse" : ""}`} />
      </TooltipIconButton>
    </span>
  );
}
