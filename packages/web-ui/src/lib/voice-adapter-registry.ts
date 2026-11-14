/**
 * Voice adapter registry — host-injectable realtime voice + read-aloud.
 *
 * assistant-ui owns realtime voice natively: ``useLocalRuntime`` accepts a
 * ``RealtimeVoiceAdapter``, the thread runtime merges the transcripts it
 * emits into ``thread.messages``, and ``useVoiceControls()`` /
 * ``useVoiceState()`` / ``useVoiceVolume()`` expose the session to any
 * component. What the runtime does NOT provide is a transport — that is
 * the adapter's whole job, and it is deliberately not something this
 * package implements.
 *
 * Threading an adapter through every chat mount would couple the shell to
 * whichever voice backend a deployment happens to use, so this is a tiny
 * registry instead — the exact pattern of :func:`registerAttachmentAdapter`
 * and ``registerChatSlots``: a module calls :func:`registerVoiceAdapter`
 * once (import time or ``useInit``) and the runtime provider picks it up on
 * its next mount.
 *
 * Nothing here knows about any particular voice service.
 * ``@lykomi/web-voice`` registers an Azure Voice Live adapter;
 * a different backend is a different registration and no change here.
 *
 * Two independent slots, because they answer different questions:
 *   - ``voice`` — a live, two-way spoken session (``RealtimeVoiceAdapter``).
 *   - ``speech`` — one-shot "read this message aloud"
 *     (``SpeechSynthesisAdapter``, driven by ``thread.speak(messageId)``).
 * A host may register either, both, or neither. Registering neither leaves
 * the runtime exactly as it was before this file existed: assistant-ui
 * reports the capability as unavailable and the UI hides the affordances.
 */

import type { RealtimeVoiceAdapter, SpeechSynthesisAdapter } from "@assistant-ui/react";
import { create } from "zustand";

interface VoiceAdapterState {
  voice: RealtimeVoiceAdapter | null;
  speech: SpeechSynthesisAdapter | null;
}

export const useVoiceAdapterStore = create<VoiceAdapterState>(() => ({
  voice: null,
  speech: null,
}));

/**
 * Register the realtime voice adapter. ``null`` clears it (the runtime
 * then reports voice as unavailable). Later calls overwrite earlier ones —
 * last registration wins.
 */
export function registerVoiceAdapter(adapter: RealtimeVoiceAdapter | null): void {
  useVoiceAdapterStore.setState({ voice: adapter });
}

/**
 * Register the read-aloud adapter behind ``thread.speak(messageId)``.
 * ``null`` clears it. Independent of :func:`registerVoiceAdapter` — a host
 * may want read-aloud without a live voice session, or the reverse.
 */
export function registerSpeechAdapter(adapter: SpeechSynthesisAdapter | null): void {
  useVoiceAdapterStore.setState({ speech: adapter });
}
