/**
 * Exhaustive, because every previous version of this decision was wrong in a
 * state nobody had enumerated. Sixteen combinations is small enough to just
 * list, and the named scenarios below say what each one MEANS.
 */
import { describe, expect, it } from "vitest";
import { needsAudioOnlySink, type AudioOwnership } from "../react/audio-ownership.ts";

const state = (o: Partial<AudioOwnership> = {}): AudioOwnership => ({
  needsElement: true,
  avatarPanels: 0,
  avatarElementExpected: false,
  predictionFailed: false,
  ...o,
});

describe("who owns the assistant's audio", () => {
  it("plays locally-decoded PCM through Web Audio, not an element", () => {
    // The WebSocket path with no avatar: the analyser is already in the graph.
    expect(needsAudioOnlySink(state({ needsElement: false }))).toBe(false);
  });

  it("mounts a sink for a remote track with no avatar — plain WebRTC", () => {
    expect(needsAudioOnlySink(state())).toBe(true);
  });

  it("mounts a sink when an avatar is configured but its panel is hidden", () => {
    // `avatar: false`. The voice still arrives as a remote track; routing it
    // through Web Audio plays nothing and the assistant goes silent.
    expect(needsAudioOnlySink(state({ avatarElementExpected: false }))).toBe(true);
  });

  it("stands down while an avatar panel is mounting", () => {
    // The count is still zero on that commit. Mounting a sink alongside gives
    // the stream two owners and it starts twice.
    expect(needsAudioOnlySink(state({ avatarElementExpected: true }))).toBe(false);
  });

  it("stays down once the panel is registered", () => {
    expect(needsAudioOnlySink(state({ avatarElementExpected: true, avatarPanels: 1 }))).toBe(false);
  });

  it("takes the audio back when the promised panel never appears", () => {
    // `stage: true` with the chat surface off screen — a closed bubble. The
    // call continues deliberately, so it must stay audible.
    expect(needsAudioOnlySink(state({ avatarElementExpected: true, predictionFailed: true }))).toBe(
      true,
    );
  });

  it("takes the audio back when a mounted panel goes away mid-call", () => {
    expect(
      needsAudioOnlySink(
        state({ avatarElementExpected: true, avatarPanels: 0, predictionFailed: true }),
      ),
    ).toBe(true);
  });

  it("never mounts a sink while a panel is mounted, whatever else is true", () => {
    // The one invariant that must hold across every combination: two owners of
    // the same stream is always wrong.
    for (const avatarElementExpected of [true, false]) {
      for (const predictionFailed of [true, false]) {
        for (const needsElement of [true, false]) {
          expect(
            needsAudioOnlySink(
              state({ avatarPanels: 1, avatarElementExpected, predictionFailed, needsElement }),
            ),
            `panels=1 expected=${avatarElementExpected} failed=${predictionFailed}`,
          ).toBe(false);
        }
      }
    }
  });

  it("never mounts a sink when no element is needed, whatever else is true", () => {
    for (const avatarPanels of [0, 1]) {
      for (const avatarElementExpected of [true, false]) {
        for (const predictionFailed of [true, false]) {
          expect(
            needsAudioOnlySink(
              state({ needsElement: false, avatarPanels, avatarElementExpected, predictionFailed }),
            ),
          ).toBe(false);
        }
      }
    }
  });
});
