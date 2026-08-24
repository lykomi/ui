/**
 * What you look at while you are talking.
 *
 * A live call replaces the conversation rather than adding to it: the
 * transcript scrolling past is not the thing you are attending to, and the
 * empty-state "How can I help you today?" is actively wrong once the answer
 * to that question is "say it out loud". The thread is not lost — it is
 * behind this, and comes straight back when the call ends. In `relay` the
 * turns are already in it; in `realtime` assistant-ui keeps them there for
 * the life of the session.
 *
 * Everything here is theme tokens and the session's own state, so it
 * inherits an app's palette without being told about it.
 */

import { useVoiceState } from "@assistant-ui/react";
import { useThemeStore } from "@iloveagents/foundry-web-ui";
import { VoiceVisualizer } from "./voice-visualizer.tsx";
import { VoiceAvatarPanel } from "./voice-avatar.tsx";
import { useVoiceUiStore } from "./voice-ui-store.ts";

export interface VoiceStageProps {
  /** Overrides the live session's avatar streams (rarely needed). */
  videoStream?: MediaStream | null;
  audioStream?: MediaStream | null;
}

export function VoiceStage(props: VoiceStageProps = {}) {
  // Read from the store by default, so the stage can be registered as a
  // bare component reference rather than a closure that has to be
  // re-registered every time a stream arrives.
  const liveVideo = useVoiceUiStore((s) => s.videoStream);
  const liveAudio = useVoiceUiStore((s) => s.audioStream);
  const videoStream = props.videoStream ?? liveVideo;
  const audioStream = props.audioStream ?? liveAudio;
  const voice = useVoiceState();
  const analyser = useVoiceUiStore((s) => s.analyser);
  const sessionState = useVoiceUiStore((s) => s.sessionState);
  const connectionState = useVoiceUiStore((s) => s.connectionState);
  const userText = useVoiceUiStore((s) => s.userText);
  const assistantText = useVoiceUiStore((s) => s.assistantText);
  // Re-read the canvas colours when the theme flips.
  const themeMode = useThemeStore((s) => s.mode);

  const connecting = !voice || voice.status.type === "starting";
  const muted = voice?.isMuted ?? false;

  const status = connecting
    ? "Connecting…"
    : connectionState === "reconnecting"
      ? "Reconnecting…"
      : muted
        ? "Microphone muted"
        : sessionState === "thinking"
          ? "Thinking…"
          : sessionState === "speaking"
            ? "Speaking"
            : "Listening";

  // While the assistant talks the visualiser is showing its voice, so the
  // caption should be its words; otherwise show what was just heard.
  const caption = sessionState === "speaking" ? assistantText : userText;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
      {videoStream ? (
        // No card: the avatar is chroma-keyed to a cut-out, and a panel
        // around it re-introduces exactly the rectangle the keying removed.
        <VoiceAvatarPanel
          videoStream={videoStream}
          audioStream={audioStream}
          className="w-[26rem] max-w-[80vw]"
        />
      ) : (
        <VoiceVisualizer
          analyser={connecting || muted ? null : analyser}
          themeKey={themeMode}
          label={`Voice conversation — ${status}`}
          className="h-56 w-full max-w-md"
        />
      )}

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {status}
      </p>

      {caption ? (
        <p className="max-w-xl text-center text-lg leading-relaxed text-foreground/90">{caption}</p>
      ) : (
        <p className="max-w-xl text-center text-sm text-muted-foreground/70">
          Say something to get started.
        </p>
      )}
    </div>
  );
}
