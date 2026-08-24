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
 *
 * Shape follows the convention every voice-capable composer has converged
 * on: a filled circular button carrying a waveform, sitting beside Send —
 * and standing down while the user is typing, because at that moment Send is
 * the action and a second filled circle is just noise. Once a session is
 * live it stays put regardless, since ending the call must always be one
 * click away.
 */

import { useAuiState, useVoiceControls, useVoiceState, useVoiceVolume } from "@assistant-ui/react";
import { TooltipIconButton } from "@iloveagents/foundry-web-ui";
import { AudioLines, Loader2, Mic, MicOff, X } from "lucide-react";
import { useVoiceUiStore } from "./voice-ui-store.ts";

/** Volume below which the ring is not drawn — room noise shouldn't make it shimmer. */
const RING_FLOOR = 0.05;

/**
 * Exactly Send's footprint, because it stands in that position: the composer
 * is a query container, and Send is `size-8` in the bubble and `size-10`
 * expanded.
 */
const CIRCLE = "size-8 @md:size-10 rounded-full shrink-0";

export function VoiceMicButton() {
  const canVoice = useAuiState((s) => s.optional.thread?.capabilities.voice ?? false);
  const composerEmpty = useAuiState((s) => s.optional.composer?.isEmpty ?? true);
  const voice = useVoiceState();
  const controls = useVoiceControls();
  const volume = useVoiceVolume();
  const connectionState = useVoiceUiStore((s) => s.connectionState);

  if (!canVoice) return null;

  const idle = !voice || voice.status.type === "ended";

  if (idle) {
    // Typing is a commitment to the keyboard; let Send have the corner.
    if (!composerEmpty) return null;
    return (
      <TooltipIconButton
        tooltip="Start voice conversation"
        variant="default"
        className={CIRCLE}
        onClick={() => controls.connect()}
      >
        <AudioLines className="size-5" />
      </TooltipIconButton>
    );
  }

  if (voice.status.type === "starting") {
    return (
      <TooltipIconButton
        tooltip="Connecting…"
        variant="default"
        className={CIRCLE}
        onClick={() => controls.disconnect()}
      >
        <Loader2 className="size-5 animate-spin" />
      </TooltipIconButton>
    );
  }

  const reconnecting = connectionState === "reconnecting";

  return (
    <span className="flex items-center gap-1">
      <TooltipIconButton
        tooltip={voice.isMuted ? "Unmute microphone" : "Mute microphone"}
        variant="ghost"
        className="size-8 @md:size-9 shrink-0 rounded-full"
        onClick={() => (voice.isMuted ? controls.unmute() : controls.mute())}
      >
        {voice.isMuted ? (
          <MicOff className="size-5 text-muted-foreground" />
        ) : (
          <Mic className="size-5" />
        )}
      </TooltipIconButton>

      <span className="relative flex items-center justify-center">
        {/* A ring scaled by the speaking level: the one cue that tells a
            silent-looking page apart from a wedged session. Behind the
            button and non-interactive, so it never eats the click. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-8 @md:size-10 rounded-full bg-primary/25 transition-transform duration-75"
          style={{ transform: `scale(${volume > RING_FLOOR ? 1 + volume * 0.4 : 0})` }}
        />
        <TooltipIconButton
          tooltip={
            reconnecting ? "Reconnecting — end voice conversation" : "End voice conversation"
          }
          variant="default"
          className={`${CIRCLE} relative ${reconnecting ? "animate-pulse" : ""}`}
          onClick={() => controls.disconnect()}
        >
          <X className="size-5" />
        </TooltipIconButton>
      </span>
    </span>
  );
}
