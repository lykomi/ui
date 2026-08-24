/**
 * Audio routing follows what the SESSION negotiated, not what we chose to show.
 *
 * A host can configure an avatar and still hide its panel. The assistant's
 * voice then arrives as a remote track that only an element can play, so
 * routing it through Web Audio as locally-decoded PCM plays nothing: the
 * assistant goes silent with no error anywhere.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "..", "react", "voice-surface.tsx"), "utf8");

describe("voice surface audio routing", () => {
  it("decides on the session's avatar, not on whether the panel is shown", () => {
    expect(source).toContain("const hasAvatar = !!session.avatar;");
    expect(source).toContain("const needsElement = hasAvatar || isWebRtc;");
    // The bug: needsElement derived from showAvatar, which folds in the
    // host's display choice.
    expect(source).not.toContain("const needsElement = showAvatar || isWebRtc;");
  });

  it("delegates the decision rather than restating it", () => {
    // The rule itself is covered exhaustively in audio-ownership.test.ts —
    // string-matching the expression here is what let a WRONG version of it
    // pass review, since the assertion moved along with the mistake. What
    // belongs here is only that the surface feeds that rule real inputs: a
    // prediction taken synchronously from the video stream, and a count
    // observed from the panels. The absence of one or the other is what caused
    // each of the three bugs this decision has had.
    expect(source).toContain("needsAudioOnlySink({");
    expect(source).toContain("const avatarElementExpected = showAvatar && !!live.videoStream;");
    expect(source).toContain("avatarPanels,");
    expect(source).toContain("predictionFailed,");
  });

  it("forwards the host's chroma-key tuning to the floating avatar too", () => {
    // The stage path already reads it; behaviour must not depend on placement.
    expect(source).toContain("chromaKeyConfig={config.chromaKey ?? undefined}");
  });
});
