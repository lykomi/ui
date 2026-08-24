/**
 * A one-line "what is the session doing right now" strip, rendered in the
 * composer banner slot while a voice session is live.
 *
 * Listening / speaking come from the runtime's own voice state; `thinking`
 * and `reconnecting` have no runtime equivalent and come from the SDK.
 * Without this, the gap between the user finishing a sentence and the
 * assistant starting to speak is indistinguishable from a dead session.
 */

import { useVoiceState } from "@assistant-ui/react";
import { useVoiceUiStore } from "./voice-ui-store.ts";

export function VoiceStatusStrip() {
  const voice = useVoiceState();
  const sessionState = useVoiceUiStore((s) => s.sessionState);
  const connectionState = useVoiceUiStore((s) => s.connectionState);

  if (!voice || voice.status.type === "ended") return null;

  const label =
    voice.status.type === "starting"
      ? "Connecting…"
      : connectionState === "reconnecting"
        ? "Reconnecting…"
        : voice.isMuted
          ? "Microphone muted"
          : sessionState === "thinking"
            ? "Thinking…"
            : voice.mode === "speaking"
              ? "Speaking…"
              : "Listening…";

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full bg-primary ${voice.isMuted ? "" : "animate-pulse"}`}
      />
      {label}
    </div>
  );
}
