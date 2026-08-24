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
import type { ChromaKeyConfig } from "@iloveagents/foundry-voice-live-react";

export interface VoiceAvatarPanelProps {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  /** Replaces the default centred placement entirely. */
  className?: string;
  /**
   * Classes for the video canvas itself.
   *
   * The SDK sets `height:auto; object-fit:contain` as an inline style, which
   * a plain class cannot beat — pass Tailwind's important modifier
   * (`object-cover!`) to override it.
   */
  canvasClassName?: string;
  /** Chroma-key tuning; defaults to a softer edge than the SDK's (see `SOFT_KEY`). */
  chromaKeyConfig?: ChromaKeyConfig;
}

const LAYER =
  "pointer-events-none fixed inset-x-0 top-1/2 z-40 flex -translate-y-1/2 justify-center px-4";
/**
 * No background, no border. The avatar arrives chroma-keyed to a cut-out, so
 * anything drawn behind it is the rectangle the keying just removed.
 */
const CARD = "pointer-events-auto w-[26rem] max-w-[80vw]";

/**
 * Softer-edged keying than the SDK default (`similarity 0.4, smoothness
 * 0.1`), which left a visible green fringe on the avatar's outline in live
 * runs. More smoothness blends the boundary pixels instead of hard-cutting
 * them; the small similarity bump removes the near-green spill the light
 * picks up at the silhouette. Hosts with different lighting override via
 * `chromaKeyConfig` (plumbed from `VoiceConfig.chromaKey`).
 */
const SOFT_KEY: ChromaKeyConfig = {
  keyColor: [0, 1, 0],
  similarity: 0.42,
  smoothness: 0.25,
};

export function VoiceAvatarPanel({
  videoStream,
  audioStream,
  className,
  canvasClassName,
  chromaKeyConfig = SOFT_KEY,
}: VoiceAvatarPanelProps) {
  if (!videoStream) return null;

  const avatar = (
    <VoiceLiveAvatar
      videoStream={videoStream}
      audioStream={audioStream}
      canvasClassName={canvasClassName}
      chromaKeyConfig={chromaKeyConfig}
    />
  );

  if (className) return <div className={className}>{avatar}</div>;

  return (
    <div className={LAYER}>
      <div className={CARD}>{avatar}</div>
    </div>
  );
}
