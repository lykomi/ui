/**
 * Play the assistant straight through Web Audio, instead of via a MediaStream
 * and an `<audio>` element.
 *
 * The SDK's WebSocket path decodes PCM in an AudioWorklet and routes it
 * `gain → MediaStreamDestination`, exposing the result as `audioStream` for a
 * consumer to attach. Attaching it works, but it hands the audio to the
 * element's *playout* path: a jitter buffer that rate-adapts to keep itself
 * from draining. At the start of a stream that buffer is empty and still
 * converging, which is audible on the first reply of a session as a crackle
 * or a slight pitch bend — and then never again, because the element keeps
 * running and stays converged.
 *
 * The analyser is already in the signal path (`gain → analyser`), and an
 * `AnalyserNode` passes audio through untouched, so connecting it to the
 * context's destination gives the same signal with one resampling stage and
 * one buffer fewer between the worklet and the speakers.
 *
 * Only for locally-decoded PCM. A WebRTC session's audio is a remote track
 * that the browser must play through an element; connecting the analyser
 * there would play it a second time.
 */

import { useEffect } from "react";

export function useDirectAudioOutput(
  enabled: boolean,
  context: AudioContext | null,
  analyser: AnalyserNode | null,
): void {
  useEffect(() => {
    if (!enabled || !context || !analyser) return;
    try {
      analyser.connect(context.destination);
    } catch {
      // A closed context throws; there is nothing to play through anyway.
      return;
    }
    return () => {
      try {
        analyser.disconnect(context.destination);
      } catch {
        // Already torn down with the context.
      }
    };
  }, [enabled, context, analyser]);
}
