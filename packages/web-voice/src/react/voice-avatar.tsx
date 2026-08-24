/**
 * The avatar surface.
 *
 * `VoiceLiveAvatar` does the real work — WebRTC video, chroma-key removal of
 * the green screen, and the hidden `<audio>` element that makes the session
 * audible. This wrapper only decides where it sits, and renders nothing
 * until a video track actually arrives, so a session configured without an
 * avatar (or one still negotiating) leaves the page untouched.
 *
 * Centred, not tucked into a corner: while an avatar is on screen it is the
 * party being spoken to, and a thumbnail in the periphery reads as a webcam
 * preview instead. The thread behind stays scrollable and selectable — the
 * positioning layer takes no pointer events, only the card does.
 */

import { VoiceLiveAvatar } from "@iloveagents/foundry-voice-live-react";

export interface VoiceAvatarPanelProps {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  /** Replaces the default centred placement entirely. */
  className?: string;
}

const LAYER =
  "pointer-events-none fixed inset-x-0 top-1/2 z-40 flex -translate-y-1/2 justify-center px-4";
const CARD =
  "pointer-events-auto w-[22rem] max-w-[75vw] overflow-hidden rounded-3xl " +
  "border border-border bg-background/70 shadow-2xl backdrop-blur";

export function VoiceAvatarPanel({ videoStream, audioStream, className }: VoiceAvatarPanelProps) {
  if (!videoStream) return null;

  const avatar = <VoiceLiveAvatar videoStream={videoStream} audioStream={audioStream} />;

  if (className) return <div className={className}>{avatar}</div>;

  return (
    <div className={LAYER}>
      <div className={CARD}>{avatar}</div>
    </div>
  );
}
