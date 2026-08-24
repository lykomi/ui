/**
 * Session facts the voice UI reads.
 *
 * Distinct from the bridge, deliberately: the bridge is the channel to
 * assistant-ui's runtime (transcripts, mode, volume, status), while this is
 * the channel to *our* components (the mic button's tooltip, the status
 * strip's wording). Mixing them would make the mic button re-render on every
 * transcript delta and put UI copy inside the protocol layer.
 *
 * Status the runtime already owns — connected, muted, listening vs speaking —
 * is read from ``useVoiceState()`` / ``useVoiceVolume()``. What lives here is
 * only what the runtime has no concept of: the SDK's finer-grained session
 * state (``thinking``) and its connection lifecycle (``reconnecting``).
 */

import { create } from "zustand";
import type { ConnectionState, SessionState } from "@iloveagents/foundry-voice-live-react";

interface VoiceUiState {
  connectionState: ConnectionState;
  sessionState: SessionState;
  isMuted: boolean;
  isReady: boolean;
}

export const useVoiceUiStore = create<VoiceUiState>(() => ({
  connectionState: "disconnected",
  sessionState: "idle",
  isMuted: false,
  isReady: false,
}));
