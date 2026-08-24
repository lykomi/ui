/**
 * `HalfDuplexGate` — decides when the microphone opens and closes while the
 * assistant is speaking.
 *
 * Half-duplex exists for speakers: the assistant's own voice trips the
 * service's VAD and it starts answering itself. The naive version — "mute
 * while speaking, unmute after" — has two failure modes that only show up
 * with a person in the loop, which is why this is a pure machine with a test
 * for each of them rather than a pair of booleans inside a React effect:
 *
 * - **The mic must never end up hot behind a muted UI.** If the user mutes
 *   *while* the auto-mute is engaged, a release that only remembers "I
 *   muted" un-mutes on their behalf: the runtime still shows muted, the SDK
 *   is capturing, and the user is being recorded while the button says they
 *   are not. Releasing therefore also requires that the user has not asked
 *   for mute in the meantime.
 *
 * - **An explicit unmute is a decision, not a glitch.** If the user unmutes
 *   mid-answer they are choosing barge-in over echo protection; re-muting
 *   them on the next tick makes interruption impossible. The gate engages
 *   only on the *transition* into speaking, so a mid-answer unmute stands
 *   until the next assistant turn.
 */

export interface HalfDuplexInputs {
  /** The feature switch (`VoiceConfig.halfDuplex`). */
  enabled: boolean;
  /** The assistant is currently speaking. */
  speaking: boolean;
  /** The SDK's capture-mute state (what the microphone is actually doing). */
  sdkMuted: boolean;
  /** The user's own intent, as expressed through the runtime's mute control. */
  userMuted: boolean;
}

export type HalfDuplexAction = "mute" | "unmute" | "none";

export class HalfDuplexGate {
  /** True while a mute this gate applied is outstanding. */
  private autoMuted = false;
  private wasSpeaking = false;

  next({ enabled, speaking, sdkMuted, userMuted }: HalfDuplexInputs): HalfDuplexAction {
    if (!enabled) {
      // Turning the feature off mid-session must not strand an auto-mute.
      const release = this.autoMuted && sdkMuted && !userMuted;
      this.autoMuted = false;
      this.wasSpeaking = speaking;
      return release ? "unmute" : "none";
    }

    const startedSpeaking = speaking && !this.wasSpeaking;
    this.wasSpeaking = speaking;

    if (speaking) {
      // Edge-triggered: engage once per assistant turn. A level-triggered
      // gate would instantly undo a user's mid-answer unmute, and with it
      // any possibility of barging in.
      if (startedSpeaking && !sdkMuted && !userMuted) {
        this.autoMuted = true;
        return "mute";
      }
      return "none";
    }

    if (this.autoMuted) {
      this.autoMuted = false;
      // Release only what this gate took. If the user asked for mute while
      // the auto-mute was engaged, unmuting here would leave the microphone
      // hot behind a UI that says muted.
      if (!userMuted && sdkMuted) return "unmute";
    }
    return "none";
  }

  /** A session ended; whatever was outstanding no longer is. */
  reset(): void {
    this.autoMuted = false;
    this.wasSpeaking = false;
  }
}
