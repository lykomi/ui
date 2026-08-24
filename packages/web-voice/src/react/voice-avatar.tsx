/**
 * The avatar surface.
 *
 * `VoiceLiveAvatar` does the real work — WebRTC video, chroma-key removal of
 * the green screen, and the hidden `<audio>` element that makes the session
 * audible. This wrapper only decides where it sits, and renders nothing
 * until a video track actually arrives, so a session configured without an
 * avatar (or one still negotiating) leaves the page untouched.
 */

import { VoiceLiveAvatar } from "@iloveagents/foundry-voice-live-react";

export interface VoiceAvatarPanelProps {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  /** Replaces the default floating placement. */
  className?: string;
}

export function VoiceAvatarPanel({ videoStream, audioStream, className }: VoiceAvatarPanelProps) {
  if (!videoStream) return null;

  return (
    <div
      className={
        className ??
        "fixed bottom-4 left-4 z-40 w-48 overflow-hidden rounded-2xl border border-border bg-background/80 shadow-lg backdrop-blur"
      }
    >
      <VoiceLiveAvatar videoStream={videoStream} audioStream={audioStream} />
    </div>
  );
}
