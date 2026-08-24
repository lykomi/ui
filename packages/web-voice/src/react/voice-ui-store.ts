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
import type {
  ChromaKeyConfig,
  ConnectionState,
  SessionState,
} from "@iloveagents/foundry-voice-live-react";

interface VoiceUiState {
  connectionState: ConnectionState;
  sessionState: SessionState;
  isMuted: boolean;
  isReady: boolean;
  /** Live output analyser, for the visualiser. Null between sessions. */
  analyser: AnalyserNode | null;
  /**
   * The last thing each side said, for the voice stage.
   *
   * Only the latest line: the stage is something you glance at while
   * talking, not a transcript to read. The thread is where history lives —
   * in `relay` these turns are already there, and in `realtime` assistant-ui
   * puts them there for the life of the session.
   */
  userText: string;
  assistantText: string;
  /** Avatar streams, when the session was configured with one. */
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  /** Host chroma-key tuning, forwarded to the avatar wherever it renders. */
  chromaKey: ChromaKeyConfig | null;
}

export const useVoiceUiStore = create<VoiceUiState>(() => ({
  connectionState: "disconnected",
  sessionState: "idle",
  isMuted: false,
  isReady: false,
  analyser: null,
  userText: "",
  assistantText: "",
  videoStream: null,
  audioStream: null,
  chromaKey: null,
}));

/**
 * Everything a finished session leaves behind. Without this, the next call
 * opens on the previous call's caption and a dead analyser — stale by
 * definition, and visibly so on the stage.
 */
export function resetVoiceSessionState(): void {
  useVoiceUiStore.setState({
    userText: "",
    assistantText: "",
    analyser: null,
    videoStream: null,
    audioStream: null,
  });
}
