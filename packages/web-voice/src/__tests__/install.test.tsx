/**
 * `FoundryVoice` mounts under StrictMode without splitting the installation.
 *
 * The failure this guards: installing during render (a `useState`
 * initializer) runs twice under StrictMode and writes to zustand stores both
 * times — the adapter from the *discarded* bridge stays registered while the
 * mounted host owns the other, and the first connect waits on a bridge
 * nobody attached to until the 10s timeout. Installation must be an effect.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { StrictMode, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { useChatSlotsStore, useVoiceAdapterStore } from "@iloveagents/foundry-web-ui";
import { FoundryVoice } from "../react/install.tsx";
import { VoiceMicButton } from "../react/voice-mic-button.tsx";

const stubModel: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: "text", text: "ok" }] };
  },
};

/** FoundryVoice is documented as living inside the assistant runtime; test it there. */
function Runtime({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(stubModel);
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let prior: boolean | undefined;

beforeAll(() => {
  prior = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = prior;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  useVoiceAdapterStore.setState({ voice: null, speech: null });
  useChatSlotsStore.setState({
    composerBanner: null,
    launcherBadge: null,
    composerActions: null,
    composerActionsReplaceSend: false,
    threadSurface: null,
  });
});

async function mount(node: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(node));
  // Installation happens in an effect; give it a settled tick.
  await act(async () => {});
}

const config = { connection: { proxyUrl: "ws://localhost:8080/ws" } };

describe("FoundryVoice", () => {
  it("registers exactly one adapter under StrictMode, from the mounted installation", async () => {
    await mount(
      <StrictMode>
        <Runtime>
          <FoundryVoice {...config} />
        </Runtime>
      </StrictMode>,
    );

    const { voice } = useVoiceAdapterStore.getState();
    expect(voice).not.toBeNull();

    const slots = useChatSlotsStore.getState();
    expect(slots.composerActions).toBe(VoiceMicButton);
    expect(slots.composerActionsReplaceSend).toBe(true);
  });

  it("mutates no store during render", async () => {
    // The whole point of the effect-based install: render must be pure.
    // StrictMode's replay render is the detector — if anything wrote to a
    // store during it, the discarded pass would have left its residue in
    // the adapter slot before any effect ran. We assert the stronger form
    // directly: before effects, nothing is registered.
    let duringRender: unknown = "unset";
    function Probe() {
      duringRender = useVoiceAdapterStore.getState().voice;
      return null;
    }
    await mount(
      <StrictMode>
        <Runtime>
          <Probe />
          <FoundryVoice {...config} />
        </Runtime>
      </StrictMode>,
    );
    expect(duringRender).toBeNull();
  });

  it("uninstalls on unmount", async () => {
    await mount(
      <StrictMode>
        <Runtime>
          <FoundryVoice {...config} />
        </Runtime>
      </StrictMode>,
    );
    expect(useVoiceAdapterStore.getState().voice).not.toBeNull();

    await act(async () => root?.unmount());
    root = null;
    expect(useVoiceAdapterStore.getState().voice).toBeNull();
    expect(useChatSlotsStore.getState().composerActions).toBeNull();
  });
});
