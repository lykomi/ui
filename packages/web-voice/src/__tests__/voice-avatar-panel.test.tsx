/**
 * The panel must announce that an avatar element exists.
 *
 * Nothing else can know. With `stage: true` the avatar is drawn by a component
 * registered as a chat slot, so the surrounding chat surface decides whether
 * it is on screen — and closing the floating panel takes the stage down while
 * the call deliberately continues. The surface uses this count to decide
 * whether it also needs a bare audio sink; without it, the assistant went
 * silent the moment the panel closed.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VoiceAvatarPanel } from "../react/voice-avatar.tsx";
import { useVoiceUiStore } from "../react/voice-ui-store.ts";

vi.mock("@iloveagents/foundry-voice-live-react", () => ({
  VoiceLiveAvatar: () => null,
}));

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let priorAct: boolean | undefined;

beforeAll(() => {
  priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  useVoiceUiStore.setState({ avatarPanels: 0 });
});

const stream = {} as MediaStream;

async function mount(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
}

describe("VoiceAvatarPanel element tracking", () => {
  it("counts itself while it is showing an avatar", async () => {
    expect(useVoiceUiStore.getState().avatarPanels).toBe(0);
    await mount(<VoiceAvatarPanel videoStream={stream} audioStream={null} />);
    expect(useVoiceUiStore.getState().avatarPanels).toBe(1);
  });

  it("stops counting when it goes away — the closed-panel case", async () => {
    await mount(<VoiceAvatarPanel videoStream={stream} audioStream={null} />);
    expect(useVoiceUiStore.getState().avatarPanels).toBe(1);

    await act(async () => root!.unmount());
    root = null;

    // The surface reads this and mounts an audio sink, so the call stays
    // audible after the panel that was playing it has gone.
    expect(useVoiceUiStore.getState().avatarPanels).toBe(0);
  });

  it("does not count when there is no video to show", async () => {
    await mount(<VoiceAvatarPanel videoStream={null} audioStream={null} />);
    expect(useVoiceUiStore.getState().avatarPanels).toBe(0);
  });
});
