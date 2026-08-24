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
  /** Chroma-key tuning; defaults to a tighter edge than the SDK's (see `AVATAR_CHROMA_KEY`). */
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
 * Keying tuned against the SDK's actual shader rather than by eye.
 *
 * That shader is `alpha = smoothstep(similarity, similarity + smoothness, d)`,
 * where `d` is the distance from the key colour in UV (chrominance) space. The
 * decisive numbers: a green screen sits at `d = 0`, edge pixels smeared by
 * 4:2:0 chroma subsampling land around `0.17`–`0.47`, and the SUBJECT is only
 * as far out as `d ≈ 0.53` — white and light grey are the closest, skin around
 * `0.58`. Subject and fringe are much nearer each other than they look.
 *
 * So `similarity + smoothness` is a hard ceiling: put it above ~0.52 and the
 * upper end of the smoothstep starts inside the subject, which does not read
 * as a soft edge — it turns the whole figure semi-transparent. An earlier
 * attempt to soften the fringe with `0.42 / 0.25` did exactly that: a grey
 * t-shirt came out 46% opaque, white 43%, skin ~70%, and the avatar rendered
 * as a washed-out ghost with a halo.
 *
 * The fringe wants the opposite move. Widening `smoothness` never removed
 * green — fringe pixels sit below `similarity` and were already fully cut —
 * it only ate the subject. Raising `similarity` while keeping the band narrow
 * is what tightens the edge: at `0.44 / 0.08` an 80%-subject edge pixel drops
 * to alpha 0.24 (the SDK default leaves it at 0.73, still visibly green) while
 * every subject colour stays fully opaque.
 *
 * Hosts with different lighting override via `chromaKeyConfig` (plumbed from
 * `VoiceConfig.chromaKey`). `chroma-key.test.ts` re-derives all of the above
 * from the shader, so a future tweak cannot quietly reintroduce the ghost.
 */
export const AVATAR_CHROMA_KEY: ChromaKeyConfig = {
  keyColor: [0, 1, 0],
  similarity: 0.44,
  smoothness: 0.08,
};

export function VoiceAvatarPanel({
  videoStream,
  audioStream,
  className,
  canvasClassName,
  chromaKeyConfig = AVATAR_CHROMA_KEY,
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
