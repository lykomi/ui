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
import { registerChatSlots, submitComposerText } from "@iloveagents/foundry-web-ui";
import { buildVoiceSession } from "../adapter/session-config.ts";
import { createRegistryToolExecutor } from "../adapter/tool-bridge.ts";
import { ToolSync } from "../adapter/tool-sync.ts";
import type { VoiceBridge, VoiceTransportControls } from "../adapter/voice-bridge.ts";
import { HalfDuplexGate } from "../adapter/half-duplex.ts";
import type { VoiceConfig } from "../adapter/types.ts";
import { RelayAnswerWatcher } from "./relay-answer-watcher.tsx";
import { VoiceAvatarPanel } from "./voice-avatar.tsx";
import { VoiceStage } from "./voice-stage.tsx";
import { VoiceAudioSink } from "./voice-audio-sink.tsx";
import { useDirectAudioOutput } from "./use-direct-audio-output.ts";
import { resetVoiceSessionState, useVoiceUiStore } from "./voice-ui-store.ts";

export interface VoiceSurfaceProps {
  bridge: VoiceBridge;
  config: VoiceConfig;
  /** Render the avatar panel when the session config asks for an avatar. @default true */
  avatar?: boolean;
  /**
   * Replace the chat thread with the voice stage while a call is live.
   * @default true
   */
  stage?: boolean;
}

export function VoiceSurface({ bridge, config, avatar = true, stage = true }: VoiceSurfaceProps) {
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
    (role: "user" | "assistant", text: string, isFinal: boolean) => {
      bridge.handleTranscript(role, text, isFinal);
      // The stage shows what is being said right now; a final empty string
      // is a VAD misfire and would blank the line for no reason.
      if (text.trim() || !isFinal) {
        useVoiceUiStore.setState(role === "user" ? { userText: text } : { assistantText: text });
      }
    },
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
  //
  // Keyed on `isReady`, not just mounted: a registry change that happens
  // while the session is still connecting used to be dropped by an
  // is-ready guard and never replayed. Re-running on the ready edge and
  // syncing immediately closes that window, and `ToolSync`'s dedupe makes
  // the extra call free when nothing actually changed.
  const hostToolsKey = JSON.stringify(config.session?.tools ?? null);
  const toolSync = useRef<ToolSync | null>(null);
  toolSync.current ??= new ToolSync((tools) => liveRef.current.updateSession({ tools }));
  useEffect(() => {
    const sync = toolSync.current;
    if (!sync) return;
    if (!wantsTools || !live.isReady) {
      // The next session sends its own catalogue; forget what this one did.
      sync.reset();
      return;
    }
    const hostTools = config.session?.tools;
    sync.sync(clientToolRegistry.getState(), hostTools);
    return clientToolRegistry.subscribe(() => sync.sync(clientToolRegistry.getState(), hostTools));
    // Keyed on the host tools' CONTENT, not the array's identity: a host that
    // rebuilds its config object every render would otherwise resubscribe on
    // every render for a catalogue that never changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsTools, live.isReady, hostToolsKey]);

  // Half-duplex: hold the microphone closed while the assistant speaks, so
  // its own voice cannot trip the service's VAD and start a conversation
  // with itself. The when-to-open/close decision lives in `HalfDuplexGate`
  // (pure, tested) — the two rules that matter, releasing only what the gate
  // took and never overriding the user's own mute, are exactly the ones an
  // inline pair of booleans got wrong.
  const halfDuplexGate = useRef(new HalfDuplexGate());
  useEffect(() => {
    const action = halfDuplexGate.current.next({
      enabled: !!config.halfDuplex,
      speaking: live.sessionState === "speaking",
      sdkMuted: live.isMuted,
      userMuted: bridge.isUserMuted,
    });
    if (action === "mute" && !liveRef.current.isMuted) liveRef.current.toggleMute();
    else if (action === "unmute" && liveRef.current.isMuted) liveRef.current.toggleMute();
  }, [bridge, config.halfDuplex, live.sessionState, live.isMuted]);

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
      analyser: live.audioAnalyser,
      videoStream: live.videoStream,
      audioStream: live.audioStream,
    });
  }, [
    live.connectionState,
    live.isMuted,
    live.isReady,
    live.audioAnalyser,
    live.videoStream,
    live.audioStream,
  ]);

  // A finished session must not leak into the next one: stale captions, a
  // dead analyser, and an outstanding auto-mute are all last-call state.
  useEffect(() => {
    if (live.connectionState === "disconnected") {
      // End the adapter session too, not just our own UI state. Without this
      // a clean remote close (or exhausted reconnects) left `bridge.connected`
      // true and assistant-ui's voice session `running`: the controls kept
      // showing a live call and relay answers were queued to a dead transport.
      bridge.handleClosed();
      halfDuplexGate.current.reset();
      resetVoiceSessionState();
    }
  }, [bridge, live.connectionState]);

  // Host chroma-key tuning travels through the store because the stage is
  // registered as a bare component reference, not a closure over config.
  useEffect(() => {
    useVoiceUiStore.setState({ chromaKey: config.chromaKey ?? null });
  }, [config.chromaKey]);

  // Hand the thread over to the stage for the duration of the call, and hand
  // it straight back afterwards. Registering the component IS the takeover,
  // so there is no second "is it active" flag to keep in step.
  const callLive = live.connectionState === "connected" || live.connectionState === "reconnecting";
  useEffect(() => {
    if (!stage) return;
    registerChatSlots({ threadSurface: callLive ? VoiceStage : null });
    return () => registerChatSlots({ threadSurface: null });
  }, [stage, callLive]);

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

  // Who plays the audio, and how.
  //
  // Avatar: `VoiceLiveAvatar` owns an element and the audio arrives with the
  // video. WebRTC: the stream is a remote track, which only an element can
  // play. Otherwise the audio is PCM this browser decoded itself, and it
  // goes straight out through Web Audio — see `useDirectAudioOutput` for why
  // that is worth doing rather than attaching the MediaStream.
  // Whether an element is needed follows from what the SESSION negotiated, not
  // from whether we chose to show a face. A host that configures an avatar but
  // hides the panel (`avatar: false`) still receives the assistant's voice as a
  // remote track, and routing that through Web Audio as if it were locally
  // decoded PCM plays nothing at all — the assistant simply goes silent.
  const hasAvatar = !!session.avatar;
  const showAvatar = avatar && hasAvatar;
  const isWebRtc = config.connection.transport === "webrtc";
  const needsElement = hasAvatar || isWebRtc;
  useDirectAudioOutput(!needsElement, live.audioContext, live.audioAnalyser);

  // Whether a sink is needed depends on whether an avatar element is ACTUALLY
  // mounted, not on whether we intended one. With `stage: true` the avatar is
  // drawn by the registered stage, and the chat surface can take that stage
  // down — closing the floating panel does exactly that — while the call
  // deliberately continues. Keyed off intent, the sink stayed absent and the
  // assistant went silent until the panel was reopened.
  const avatarPanels = useVoiceUiStore((s) => s.avatarPanels);
  const needsAudioOnlySink = needsElement && avatarPanels === 0;

  return (
    <>
      {mode === "relay" ? <RelayAnswerWatcher bridge={bridge} /> : null}
      {showAvatar && !stage ? (
        // With the stage on, the avatar is drawn there instead of floating.
        <VoiceAvatarPanel
          videoStream={live.videoStream}
          audioStream={live.audioStream}
          // Tuning must not depend on where the avatar happens to be drawn.
          chromaKeyConfig={config.chromaKey ?? undefined}
        />
      ) : needsAudioOnlySink ? (
        <VoiceAudioSink stream={live.audioStream} />
      ) : null}
    </>
  );
}
