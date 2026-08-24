/**
 * The sink must yield the instant an avatar panel exists — not a frame later.
 *
 * `needsAudioOnlySink` keeps the two apart in every state it can see, but it
 * cannot see the commit in which a panel mounts: the panel registers itself in
 * an effect while this element is already playing. One frame of the same
 * stream through two elements is the same audio at double amplitude, which is
 * a click. This is the case a re-render cannot fix, because the re-render is
 * the frame being closed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VoiceAudioSink } from "../react/voice-audio-sink.tsx";
import { trackAvatarPanel, useVoiceUiStore } from "../react/voice-ui-store.ts";

const played: string[] = [];

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom implements neither.
  HTMLMediaElement.prototype.play = vi.fn(function (this: HTMLMediaElement) {
    played.push("play");
    return Promise.resolve();
  });
  HTMLMediaElement.prototype.pause = vi.fn(function (this: HTMLMediaElement) {
    played.push("pause");
  });
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  played.length = 0;
  useVoiceUiStore.setState({ avatarPanels: 0 });
});

async function mount(stream: MediaStream | null) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<VoiceAudioSink stream={stream} />));
}

const stream = {} as MediaStream;

describe("VoiceAudioSink", () => {
  it("plays the stream when nothing else will", () => {
    return mount(stream).then(() => {
      expect(played).toContain("play");
    });
  });

  it("pauses as soon as an avatar panel registers", async () => {
    await mount(stream);
    played.length = 0;

    // Exactly what VoiceAvatarPanel does in its mount effect. No act() and no
    // re-render: the point is that this takes effect without one.
    trackAvatarPanel(1);

    expect(played, "the sink kept playing alongside a mounting avatar").toEqual(["pause"]);
  });

  it("resumes when the last avatar panel goes away", async () => {
    await mount(stream);
    trackAvatarPanel(1);
    played.length = 0;

    trackAvatarPanel(-1);

    expect(played).toEqual(["play"]);
  });

  it("does not start playing when it has no stream", async () => {
    await mount(null);
    played.length = 0;
    trackAvatarPanel(1);
    trackAvatarPanel(-1);
    expect(played).not.toContain("play");
  });
});
