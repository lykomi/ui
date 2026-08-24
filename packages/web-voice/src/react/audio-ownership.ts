/**
 * Who plays the assistant's audio.
 *
 * A pure decision rather than a chain of conditions inside the surface,
 * because this one question has been got wrong three times, each time in a
 * state nobody thought to enumerate:
 *
 * 1. Keyed on whether the host CONFIGURED an avatar, so hiding the panel
 *    (`avatar: false`) routed a remote track through Web Audio as if it were
 *    locally-decoded PCM and the assistant simply went silent.
 * 2. Keyed on a count the panels keep, which cannot answer on the commit where
 *    an avatar mounts — the count is still zero while `VoiceLiveAvatar` mounts
 *    its own audio element, so both owned the stream and it started twice.
 * 3. Guarded with a settled flag that only delayed the REVERSE handoff, so the
 *    mounting case above was left exactly as it was.
 *
 * The shape that works: predict, then verify. A panel renders exactly when
 * there is a video stream to draw, so an incoming element is known
 * synchronously and the sink can stand down before it arrives. The prediction
 * is wrong in one direction only — with `stage: true` the panel belongs to a
 * registered chat slot, and the surrounding surface may not be on screen (a
 * closed bubble) — so when nothing registers, the caller reports the
 * prediction failed and the sink takes the audio back.
 */

export interface AudioOwnership {
  /** An element is required at all: a remote track (WebRTC, or an avatar). */
  needsElement: boolean;
  /** How many `VoiceAvatarPanel`s are mounted right now. */
  avatarPanels: number;
  /** A panel is about to render: the avatar is shown and its video has arrived. */
  avatarElementExpected: boolean;
  /** Nothing registered after that prediction, so no panel is going to appear. */
  predictionFailed: boolean;
}

/**
 * Whether the surface must mount a bare `<audio>` sink of its own.
 *
 * False whenever an avatar element already exists or is about to, since that
 * element plays the same stream.
 */
export function needsAudioOnlySink({
  needsElement,
  avatarPanels,
  avatarElementExpected,
  predictionFailed,
}: AudioOwnership): boolean {
  if (!needsElement) return false;
  if (avatarPanels > 0) return false;
  return !avatarElementExpected || predictionFailed;
}
