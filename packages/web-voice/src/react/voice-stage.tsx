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
  const chromaKey = useVoiceUiStore((s) => s.chromaKey);

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
    <div className="relative flex h-full min-h-full flex-col">
      {/* The visual takes all the room there is; the caption block below has
          a reserved height so a one-line answer growing to two does not shove
          the visual up the screen mid-sentence. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {videoStream ? (
          // Full-bleed and anchored to the top, so the avatar is framed head
          // and torso with the legs running off the lower edge — the framing
          // a person on a call has, rather than a full-length figure floating
          // in the middle of the page. The `!` overrides the SDK canvas's
          // inline `height:auto; object-fit:contain`.
          <VoiceAvatarPanel
            videoStream={videoStream}
            audioStream={audioStream}
            chromaKeyConfig={chromaKey ?? undefined}
            className="absolute inset-0"
            canvasClassName="h-full! w-full! max-h-none! max-w-none! object-cover! object-top!"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <VoiceVisualizer
              analyser={connecting || muted ? null : analyser}
              label={`Voice conversation — ${status}`}
              className="h-full max-h-80 w-full max-w-md"
            />
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-6 pb-8 pt-4 text-center">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {status}
        </p>
        {/* Two lines reserved, always. */}
        <p
          className={
            "mx-auto mt-2 flex h-14 max-w-xl items-start justify-center overflow-hidden " +
            "text-lg leading-7 " +
            (caption ? "text-foreground/90" : "text-sm leading-7 text-muted-foreground/70")
          }
        >
          <span className="line-clamp-2">{caption || "Say something to get started."}</span>
        </p>
      </div>
    </div>
  );
}
