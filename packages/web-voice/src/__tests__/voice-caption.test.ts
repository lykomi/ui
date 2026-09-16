import { beforeEach, describe, expect, it } from "vitest";
import {
  resetVoiceSessionState,
  updateVoiceCaption,
  useVoiceUiStore,
} from "../react/voice-ui-store.ts";

beforeEach(resetVoiceSessionState);

describe("voice captions", () => {
  it("keeps the assistant caption through playback pauses and empty transcript events", () => {
    updateVoiceCaption("user", "Hello");
    updateVoiceCaption("assistant", "Hi, how can I help?");
    for (const sessionState of ["speaking", "thinking", "listening"] as const) {
      useVoiceUiStore.setState({ sessionState });
      updateVoiceCaption("user", "");
      updateVoiceCaption("assistant", " ");
      expect(useVoiceUiStore.getState()).toMatchObject({
        transcriptRole: "assistant",
        assistantText: "Hi, how can I help?",
      });
    }
    // The same utterance in a later turn still changes the caption's speaker.
    updateVoiceCaption("user", "Hello");
    expect(useVoiceUiStore.getState()).toMatchObject({ transcriptRole: "user", userText: "Hello" });
  });

  it("clears the caption when the call ends", () => {
    updateVoiceCaption("assistant", "Goodbye");
    resetVoiceSessionState();
    expect(useVoiceUiStore.getState()).toMatchObject({
      transcriptRole: null,
      userText: "",
      assistantText: "",
    });
  });
});
