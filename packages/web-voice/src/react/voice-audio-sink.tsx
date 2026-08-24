/**
 * Plays the assistant's audio when no avatar is doing it.
 *
 * The SDK routes playback into a ``MediaStreamAudioDestinationNode`` exposed
 * as ``audioStream`` rather than to the speakers directly, so *something*
 * must attach it to an element. ``VoiceLiveAvatar`` does that itself; in
 * voice-only mode nothing does, and the session is silent — connected,
 * transcribing, and inaudible.
 */

import { useEffect, useRef } from "react";

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

  return <audio ref={ref} autoPlay hidden aria-hidden="true" />;
}
