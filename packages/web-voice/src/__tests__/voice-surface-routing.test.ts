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

  it("mounts an audio-only sink whenever no avatar element is actually mounted", () => {
    // Not "when the host hid the panel": with `stage: true` the avatar is
    // drawn by the registered stage, and the chat surface can take that stage
    // down — closing the floating panel does — while the call continues.
    // Keyed off intent rather than fact, the sink stayed absent and the
    // assistant went silent until the panel was reopened.
    expect(source).toContain("const needsAudioOnlySink = needsElement && avatarPanels === 0;");
    expect(source).toContain("needsAudioOnlySink ? (");
    expect(source).not.toContain("needsElement && !showAvatar");
  });

  it("forwards the host's chroma-key tuning to the floating avatar too", () => {
    // The stage path already reads it; behaviour must not depend on placement.
    expect(source).toContain("chromaKeyConfig={config.chromaKey ?? undefined}");
  });
});
