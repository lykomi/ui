/**
 * `VoiceSurface` — the render-less host that owns the Voice Live session.
 *
 * `useVoiceLive` is a hook, so the session can only exist inside a mounted
 * component; assistant-ui's `RealtimeVoiceAdapter.connect()` is imperative
 * and may be called at any moment after that. This component is the join:
 * it mounts the hook once (inert — `autoConnect` is off, nothing touches the
 * microphone until the user asks) and publishes its controls to the bridge,
 * which is what the adapter awaits.
 *
 * Every callback handed to the hook is stable and closes over nothing but
 * the bridge, so none of them can go stale for the life of a session.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVoiceLive } from "@iloveagents/foundry-voice-live-react";
import type {
  SessionState,
  VoiceLiveClientEvent,
  VoiceLiveServerEvent,
  VoiceLiveSessionConfig,
} from "@iloveagents/foundry-voice-live-react";
import { clientToolRegistry } from "@iloveagents/foundry-agent";
import { submitComposerText } from "@iloveagents/foundry-web-ui";
import { buildVoiceSession, toVoiceLiveTools } from "../adapter/session-config.ts";
import { createRegistryToolExecutor } from "../adapter/tool-bridge.ts";
import type { VoiceBridge, VoiceTransportControls } from "../adapter/voice-bridge.ts";
import type { VoiceConfig } from "../adapter/types.ts";
import { RelayAnswerWatcher } from "./relay-answer-watcher.tsx";
import { VoiceAvatarPanel } from "./voice-avatar.tsx";
import { VoiceAudioSink } from "./voice-audio-sink.tsx";
import { useVoiceUiStore } from "./voice-ui-store.ts";

export interface VoiceSurfaceProps {
  bridge: VoiceBridge;
  config: VoiceConfig;
  /** Render the avatar panel when the session config asks for an avatar. @default true */
  avatar?: boolean;
}

export function VoiceSurface({ bridge, config, avatar = true }: VoiceSurfaceProps) {
  const mode = config.mode ?? "relay";
  const wantsTools = mode === "realtime" && (config.exposeClientTools ?? true);

  const session = useMemo<VoiceLiveSessionConfig>(
    () =>
      buildVoiceSession({
        mode,
        overrides: config.session,
        registry: wantsTools ? clientToolRegistry.getState() : undefined,
      }),
    [mode, config.session, wantsTools],
  );

  const onEvent = useCallback(
    (event: VoiceLiveServerEvent) => bridge.handleServerEvent(event),
    [bridge],
  );
  const onTranscript = useCallback(
    (role: "user" | "assistant", text: string, isFinal: boolean) =>
      bridge.handleTranscript(role, text, isFinal),
    [bridge],
  );
  const toolExecutor = useMemo(
    () => (wantsTools ? createRegistryToolExecutor(clientToolRegistry.getState()) : undefined),
    [wantsTools],
  );

  const live = useVoiceLive({
    connection: config.connection,
    session,
    autoConnect: false,
    logLevel: config.logLevel,
    reconnect: config.reconnect,
    onEvent,
    onTranscript,
    toolExecutor,
  });

  // The hook returns a fresh object every render; the controls handed to the
  // bridge must not. Route them through a ref so `attach` happens once and
  // still reaches the current session.
  const liveRef = useRef(live);
  liveRef.current = live;

  const controls = useMemo<VoiceTransportControls>(
    () => ({
      connect: () => liveRef.current.connect(),
      disconnect: () => liveRef.current.disconnect(),
      mute: () => {
        if (!liveRef.current.isMuted) liveRef.current.toggleMute();
      },
      unmute: () => {
        if (liveRef.current.isMuted) liveRef.current.toggleMute();
      },
      sendEvent: (event: VoiceLiveClientEvent) => liveRef.current.sendEvent(event),
      cancelResponse: () => liveRef.current.cancelResponse(),
      getAnalyser: () => liveRef.current.audioAnalyser,
    }),
    [],
  );

  useEffect(() => bridge.attach(controls), [bridge, controls]);

  useEffect(() => {
    bridge.setSubmitText(mode === "relay" ? submitComposerText : null);
    return () => bridge.setSubmitText(null);
  }, [bridge, mode]);

  // Keep the voice model's tool catalogue in step with the page's. Page
  // tools are registered and cleared on navigation, so a catalogue frozen
  // at connect time leaves the model either unable to act on the page the
  // user is looking at, or calling a tool that no longer exists.
  useEffect(() => {
    if (!wantsTools) return;
    return clientToolRegistry.subscribe(() => {
      if (!liveRef.current.isReady) return;
      liveRef.current.updateSession({ tools: toVoiceLiveTools(clientToolRegistry.getState()) });
    });
  }, [wantsTools]);

  // Publish session facts the UI reads (mic button, status strip). The
  // bridge is the adapter's channel; this store is the components'.
  const sessionState: SessionState = live.sessionState;
  useEffect(() => {
    bridge.handleSessionState(sessionState);
    useVoiceUiStore.setState({ sessionState });
  }, [bridge, sessionState]);

  useEffect(() => {
    useVoiceUiStore.setState({
      connectionState: live.connectionState,
      isMuted: live.isMuted,
      isReady: live.isReady,
    });
  }, [live.connectionState, live.isMuted, live.isReady]);

  // Surface a session-fatal error once. `error` stays set until the next
  // connect, so re-reporting it on every render would end the session
  // repeatedly and spam the host's callback.
  const reportedError = useRef<string | null>(null);
  useEffect(() => {
    if (live.error && live.error !== reportedError.current) {
      reportedError.current = live.error;
      bridge.handleError(live.error);
    } else if (!live.error) {
      reportedError.current = null;
    }
  }, [bridge, live.error]);

  // `VoiceLiveAvatar` owns the audio element in avatar mode; in voice-only
  // mode nothing does, and the SDK's playback graph terminates in a
  // MediaStream that has to be attached to be heard.
  const showAvatar = avatar && !!session.avatar;

  return (
    <>
      {mode === "relay" ? <RelayAnswerWatcher bridge={bridge} /> : null}
      {showAvatar ? (
        <VoiceAvatarPanel videoStream={live.videoStream} audioStream={live.audioStream} />
      ) : (
        <VoiceAudioSink stream={live.audioStream} />
      )}
    </>
  );
}
