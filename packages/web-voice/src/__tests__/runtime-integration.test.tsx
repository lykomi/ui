/**
 * The claim this package makes is that a spoken turn lands in the *same*
 * thread as a typed one. Unit tests prove the bridge emits the right things;
 * only a mounted runtime proves assistant-ui turns them into messages.
 *
 * Harness style matches the rest of the repo (`composer-input-strictmode`):
 * raw `createRoot` + `act`, a stub chat model, no testing-library.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useAuiState,
  useLocalRuntime,
  useVoiceControls,
  type ChatModelAdapter,
  type RealtimeVoiceAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import { TooltipProvider } from "@iloveagents/foundry-web-ui";
import { VoiceBridge, type VoiceTransportControls } from "../adapter/voice-bridge.ts";
import type { VoiceConfig } from "../adapter/types.ts";
import { VoiceMicButton } from "../react/voice-mic-button.tsx";

const stubModel: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: "text", text: "typed reply" }] };
  },
};

function fakeControls(): VoiceTransportControls {
  return {
    connect: async () => {},
    disconnect: () => {},
    mute: () => {},
    unmute: () => {},
    sendEvent: () => {},
    cancelResponse: () => {},
    getAnalyser: () => null,
  };
}

interface Probe {
  messages: readonly ThreadMessage[];
  canVoice: boolean;
  connect: () => void;
  disconnect: () => void;
}

const probe: Probe = {
  messages: [],
  canVoice: false,
  connect: () => {},
  disconnect: () => {},
};

function Probe() {
  probe.messages = useAuiState((s) => s.thread.messages) as readonly ThreadMessage[];
  probe.canVoice = useAuiState((s) => s.optional.thread?.capabilities.voice ?? false);
  const controls = useVoiceControls();
  probe.connect = controls.connect;
  probe.disconnect = controls.disconnect;
  return null;
}

function Harness({ voice }: { voice?: RealtimeVoiceAdapter }) {
  const runtime = useLocalRuntime(stubModel, {
    adapters: voice ? { voice } : {},
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider>
        <Probe />
        <VoiceMicButton />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let priorActEnvironment: boolean | undefined;

beforeAll(() => {
  priorActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorActEnvironment;
});

async function mount(voice?: RealtimeVoiceAdapter) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness voice={voice} />);
  });
  // The voice capability flips in `__internal_setOptions`, which runs in a
  // post-render effect; one more tick lets the probe observe it.
  await act(async () => {});
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const config = (mode: VoiceConfig["mode"]): VoiceConfig => ({
  mode,
  connection: { proxyUrl: "ws://localhost:8080/ws" },
});

/** Wait for the adapter's async `setup` to resolve inside act(). */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("runtime integration", () => {
  it("reports voice as unavailable when no adapter is registered", async () => {
    await mount();
    expect(probe.canVoice).toBe(false);
  });

  it("flips the voice capability once an adapter is supplied", async () => {
    const bridge = new VoiceBridge(config("realtime"));
    await mount(bridge.createAdapter());
    expect(probe.canVoice).toBe(true);
  });

  it("puts a realtime spoken turn into the same thread as a typed one", async () => {
    const bridge = new VoiceBridge(config("realtime"));
    bridge.attach(fakeControls());
    await mount(bridge.createAdapter());

    await act(async () => {
      probe.connect();
    });
    await settle();

    await act(async () => {
      bridge.handleTranscript("user", "what is the notice period", true);
      bridge.handleTranscript("assistant", "Thirty days.", true);
    });

    expect(probe.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(probe.messages[0]!.content).toEqual([
      { type: "text", text: "what is the notice period" },
    ]);
    expect(probe.messages[1]!.content).toEqual([{ type: "text", text: "Thirty days." }]);
  });

  it("replaces the streaming assistant message rather than appending to it", async () => {
    const bridge = new VoiceBridge(config("realtime"));
    bridge.attach(fakeControls());
    await mount(bridge.createAdapter());

    await act(async () => {
      probe.connect();
    });
    await settle();

    await act(async () => {
      bridge.handleTranscript("assistant", "Thirty", false);
      bridge.handleTranscript("assistant", "Thirty days", false);
      bridge.handleTranscript("assistant", "Thirty days.", true);
    });

    // The SDK's transcript text is cumulative; three deltas must be one
    // message, not three.
    expect(probe.messages).toHaveLength(1);
    expect(probe.messages[0]!.content).toEqual([{ type: "text", text: "Thirty days." }]);
  });

  it("adds nothing to the thread in relay mode", async () => {
    // Relay's user turn arrives through the composer and its answer through
    // the chat model. If the adapter also emitted transcripts, every spoken
    // question would be drawn twice.
    const bridge = new VoiceBridge(config("relay"));
    bridge.attach(fakeControls());
    await mount(bridge.createAdapter());

    await act(async () => {
      probe.connect();
    });
    await settle();

    await act(async () => {
      bridge.handleTranscript("user", "hello", true);
      bridge.handleTranscript("assistant", "hi there", true);
    });

    expect(probe.messages).toEqual([]);
  });

  it("clears the spoken turn on disconnect, as assistant-ui defines it", async () => {
    // Documented behaviour, asserted so the README's claim stays true: voice
    // messages are session-scoped and never reach a history adapter.
    const bridge = new VoiceBridge(config("realtime"));
    bridge.attach(fakeControls());
    await mount(bridge.createAdapter());

    await act(async () => {
      probe.connect();
    });
    await settle();
    await act(async () => bridge.handleTranscript("user", "hello", true));
    expect(probe.messages).toHaveLength(1);

    await act(async () => {
      probe.disconnect();
    });
    expect(probe.messages).toEqual([]);
  });

  it("shows no mic button when the runtime has no voice", async () => {
    await mount();
    expect(container!.querySelector("button")).toBeNull();
  });

  it("offers to start, then to mute and end, once voice is available", async () => {
    const bridge = new VoiceBridge(config("relay"));
    bridge.attach(fakeControls());
    await mount(bridge.createAdapter());

    // TooltipIconButton names itself with an `sr-only` span, not aria-label.
    const labels = () =>
      [...container!.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(labels()).toEqual(["Start voice conversation"]);

    await act(async () => {
      probe.connect();
    });
    await settle();

    expect(labels()).toEqual(["Mute microphone", "End voice conversation"]);

    await act(async () => {
      probe.disconnect();
    });
    expect(labels()).toEqual(["Start voice conversation"]);
  });
});
