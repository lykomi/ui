/**
 * Plays the assistant's audio when no avatar is doing it.
 *
 * The SDK routes playback into a ``MediaStreamAudioDestinationNode`` exposed
 * as ``audioStream`` rather than to the speakers directly, so *something*
 * must attach it to an element. ``VoiceLiveAvatar`` does that itself; in
 * voice-only mode nothing does, and the session is silent — connected,
 * transcribing, and inaudible.
 *
 * It also stands down the instant an avatar panel exists, without waiting to
 * be unmounted. `needsAudioOnlySink` keeps the two apart in every state it can
 * see, but it cannot see the commit in which a panel mounts: the panel
 * registers itself in an effect, and this element is already playing by then.
 * That is one frame of the same stream through two elements — the same audio
 * at double amplitude, which is a click rather than an echo. Subscribing to
 * the count pauses this element in the same effect flush that registers the
 * panel, so the handoff is silent in both directions.
 */

import { useEffect, useRef } from "react";
import { useVoiceUiStore } from "./voice-ui-store.ts";

export function VoiceAudioSink({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (!stream) return;
    // Autoplay is allowed here: a voice session only ever starts from a
    // click on the mic, which is the user gesture the policy wants.
    void el.play().catch(() => {
      /* a blocked play surfaces as silence, not an unhandled rejection */
    });
  }, [stream]);

  useEffect(() => {
    const apply = (panels: number) => {
      const el = ref.current;
      if (!el) return;
      if (panels > 0) {
        el.pause();
      } else if (el.srcObject) {
        void el.play().catch(() => {});
      }
    };
    apply(useVoiceUiStore.getState().avatarPanels);
    // Imperative, not a re-render: a re-render lands a frame later, which is
    // exactly the frame being closed here.
    return useVoiceUiStore.subscribe((s) => apply(s.avatarPanels));
  }, []);

  return <audio ref={ref} autoPlay hidden aria-hidden="true" />;
}
