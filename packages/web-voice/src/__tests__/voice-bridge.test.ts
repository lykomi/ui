import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeVoiceAdapter } from "@assistant-ui/react";
import type { VoiceLiveServerEvent } from "@iloveagents/foundry-voice-live-react";
import { VoiceBridge, readLevel, type VoiceTransportControls } from "../adapter/voice-bridge.ts";
import type { VoiceConfig } from "../adapter/types.ts";

/** A transport that records what the bridge puts on the wire. */
function fakeControls(): VoiceTransportControls & {
  sent: Record<string, unknown>[];
  connected: boolean;
  cancelled: number;
} {
  const state = {
    sent: [] as Record<string, unknown>[],
    connected: false,
    cancelled: 0,
  };
  return Object.assign(state, {
    connect: async () => {
      state.connected = true;
    },
    disconnect: () => {
      state.connected = false;
    },
    mute: vi.fn(),
    unmute: vi.fn(),
    sendEvent: (event: unknown) => {
      state.sent.push(event as Record<string, unknown>);
    },
    cancelResponse: () => {
      state.cancelled += 1;
    },
    getAnalyser: () => null,
  });
}

/** Connect a bridge and collect everything the resulting session emits. */
async function connect(bridge: VoiceBridge, controls: VoiceTransportControls) {
  bridge.attach(controls);
  const session = bridge.createAdapter().connect({});
  const transcripts: RealtimeVoiceAdapter.TranscriptItem[] = [];
  const modes: RealtimeVoiceAdapter.Mode[] = [];
  const statuses: RealtimeVoiceAdapter.Status[] = [];
  session.onTranscript((t) => transcripts.push(t));
  session.onModeChange((m) => modes.push(m));
  session.onStatusChange((s) => statuses.push(s));
  // Let the async `setup` in createVoiceSession run to completion.
  await vi.waitFor(() => expect(session.status.type).toBe("running"));
  return { session, transcripts, modes, statuses };
}

const relay = (over: Partial<VoiceConfig> = {}): VoiceConfig => ({
  mode: "relay",
  connection: { proxyUrl: "ws://localhost:8080/ws" },
  ...over,
});
const realtime = (over: Partial<VoiceConfig> = {}): VoiceConfig => ({
  ...relay(over),
  mode: "realtime",
});

const speechStarted = { type: "input_audio_buffer.speech_started" } as VoiceLiveServerEvent;
const responseDone = { type: "response.done" } as VoiceLiveServerEvent;

beforeEach(() => {
  vi.useRealTimers();
});

describe("connect", () => {
  it("reaches running once the host's transport is up", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    const { statuses } = await connect(bridge, controls);
    expect(controls.connected).toBe(true);
    expect(statuses).toContainEqual({ type: "running" });
  });

  it("waits for a host that mounts after connect was called", async () => {
    // The mic can be clicked before the host component has attached; the
    // adapter must hold the session in `starting`, not fail.
    const bridge = new VoiceBridge(relay());
    const session = bridge.createAdapter().connect({});
    expect(session.status.type).toBe("starting");

    const controls = fakeControls();
    bridge.attach(controls);
    await vi.waitFor(() => expect(session.status.type).toBe("running"));
    expect(controls.connected).toBe(true);
  });

  it("ends with an error when no host ever attaches", async () => {
    vi.useFakeTimers();
    const bridge = new VoiceBridge(relay());
    const session = bridge.createAdapter().connect({});
    await vi.advanceTimersByTimeAsync(11_000);
    expect(session.status).toMatchObject({ type: "ended", reason: "error" });
    vi.useRealTimers();
  });
});

describe("realtime mode", () => {
  it("republishes both roles so the thread shows the spoken turn", async () => {
    const bridge = new VoiceBridge(realtime());
    const { transcripts } = await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "what is the notice period", true);
    bridge.handleTranscript("assistant", "Thirty", false);
    bridge.handleTranscript("assistant", "Thirty days.", true);

    expect(transcripts).toEqual([
      { role: "user", text: "what is the notice period", isFinal: true },
      { role: "assistant", text: "Thirty", isFinal: false },
      { role: "assistant", text: "Thirty days.", isFinal: true },
    ]);
  });

  it("never submits to the composer", async () => {
    const submit = vi.fn();
    const bridge = new VoiceBridge(realtime());
    bridge.setSubmitText(submit);
    await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "hello", true);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("relay mode", () => {
  it("submits the final user transcript to the composer", async () => {
    const submit = vi.fn();
    const bridge = new VoiceBridge(relay());
    bridge.setSubmitText(submit);
    await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "what is the", false);
    bridge.handleTranscript("user", "what is the notice period", true);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("what is the notice period");
  });

  it("emits no transcripts at all", async () => {
    // Emitting them as well as submitting would draw the user's question
    // twice — once as a voice message, once as the real composer turn.
    const bridge = new VoiceBridge(relay());
    bridge.setSubmitText(vi.fn());
    const { transcripts } = await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "hello", true);
    bridge.handleTranscript("assistant", "hi", true);
    expect(transcripts).toEqual([]);
  });

  it("ignores an empty final transcript from a VAD false positive", async () => {
    const submit = vi.fn();
    const bridge = new VoiceBridge(relay());
    bridge.setSubmitText(submit);
    await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "   ", true);
    expect(submit).not.toHaveBeenCalled();
  });

  it("still reports every transcript to the host callback", async () => {
    const onTranscript = vi.fn();
    const bridge = new VoiceBridge(relay({ onTranscript }));
    bridge.setSubmitText(vi.fn());
    await connect(bridge, fakeControls());

    bridge.handleTranscript("assistant", "partial", false);
    expect(onTranscript).toHaveBeenCalledWith({
      role: "assistant",
      text: "partial",
      isFinal: false,
    });
  });

  it("speaks the answer sentence by sentence as it streams", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    // A terminator at the very end of the buffer is still ambiguous — the
    // next token could make it "3." of "3.5". The sentence is released once
    // the following whitespace proves it was a sentence end.
    bridge.trackAnswer("m1", "The notice period is thirty days.", false);
    expect(controls.sent).toHaveLength(0);

    bridge.trackAnswer("m1", "The notice period is thirty days. It", false);
    expect(controls.sent).toHaveLength(1);
    expect(controls.sent[0]).toEqual({
      type: "response.create",
      response: {
        pre_generated_assistant_message: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "The notice period is thirty days." }],
        },
      },
    });

    // The second sentence waits for the first response to finish.
    bridge.trackAnswer("m1", "The notice period is thirty days. It runs from receipt.", true);
    expect(controls.sent).toHaveLength(1);
    bridge.handleServerEvent(responseDone);
    expect(controls.sent).toHaveLength(2);
    expect(
      (
        controls.sent[1] as {
          response: { pre_generated_assistant_message: { content: { text: string }[] } };
        }
      ).response.pre_generated_assistant_message.content[0]!.text,
    ).toBe("It runs from receipt.");
  });

  it("speaks the prose, not the markdown", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.trackAnswer("m1", "The **notice** period is thirty days [2].", true);
    const spoken = (
      controls.sent[0] as {
        response: { pre_generated_assistant_message: { content: { text: string }[] } };
      }
    ).response.pre_generated_assistant_message.content[0]!.text;
    expect(spoken).toBe("The notice period is thirty days.");
  });

  it("does not speak while no voice session is live", () => {
    // The relay watcher is mounted for the whole app lifetime; typed
    // conversations must not queue speech at a disconnected transport.
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    bridge.attach(controls);

    bridge.trackAnswer("m1", "A typed answer.", true);
    expect(controls.sent).toHaveLength(0);
  });

  it("starts a fresh utterance stream for each answer", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.trackAnswer("m1", "First answer.", true);
    bridge.handleServerEvent(responseDone);
    bridge.trackAnswer("m2", "Second answer.", true);

    const texts = controls.sent.map(
      (e) =>
        (e as { response: { pre_generated_assistant_message: { content: { text: string }[] } } })
          .response.pre_generated_assistant_message.content[0]!.text,
    );
    expect(texts).toEqual(["First answer.", "Second answer."]);
  });

  it("drops queued speech and cancels the wire on barge-in", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.trackAnswer("m1", "One. Two. Three. Four.", true);
    expect(controls.sent).toHaveLength(1);

    bridge.handleServerEvent(speechStarted);
    expect(controls.cancelled).toBe(1);

    // Everything still queued is abandoned — the user asked something else.
    bridge.handleServerEvent(responseDone);
    expect(controls.sent).toHaveLength(1);
  });

  it("does not cancel the wire when nothing is being spoken", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.handleServerEvent(speechStarted);
    expect(controls.cancelled).toBe(0);
  });
});

describe("session lifecycle", () => {
  it("maps the SDK's session state onto the runtime's two modes", async () => {
    const bridge = new VoiceBridge(relay());
    const { modes } = await connect(bridge, fakeControls());

    bridge.handleSessionState("listening");
    bridge.handleSessionState("thinking");
    bridge.handleSessionState("speaking");
    bridge.handleSessionState("idle");

    expect(modes).toEqual(["listening", "listening", "speaking", "listening"]);
  });

  it("ends the session and reports a fatal error once", async () => {
    const onError = vi.fn();
    const bridge = new VoiceBridge(relay({ onError }));
    const { session } = await connect(bridge, fakeControls());

    bridge.handleError("WebSocket connection error");

    expect(onError).toHaveBeenCalledWith("WebSocket connection error");
    expect(session.status).toMatchObject({ type: "ended", reason: "error" });
  });

  it("stops speaking when the session is disconnected", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    const { session } = await connect(bridge, controls);

    bridge.trackAnswer("m1", "One. Two.", true);
    expect(controls.sent).toHaveLength(1);

    session.disconnect();
    expect(controls.connected).toBe(false);

    // The queue was cleared, so a late response.done releases nothing.
    bridge.handleServerEvent(responseDone);
    expect(controls.sent).toHaveLength(1);
  });
});

describe("readLevel", () => {
  it("is zero without an analyser", () => {
    expect(readLevel(null, new Uint8Array(new ArrayBuffer(4)))).toBe(0);
  });

  it("reports peak deviation from silence, normalised", () => {
    const analyser = {
      fftSize: 4,
      getByteTimeDomainData: (b: Uint8Array) => b.set([128, 192, 128, 64]),
    } as unknown as AnalyserNode;
    expect(readLevel(analyser, new Uint8Array(new ArrayBuffer(4)))).toBeCloseTo(0.5, 5);
  });

  it("never reads past the analyser's own sample count", () => {
    // A buffer larger than fftSize keeps stale samples in its tail; reading
    // them would report a level from a previous, louder moment forever.
    const buffer = new Uint8Array(new ArrayBuffer(8));
    buffer.fill(255);
    const analyser = {
      fftSize: 2,
      getByteTimeDomainData: (b: Uint8Array) => {
        b[0] = 128;
        b[1] = 128;
      },
    } as unknown as AnalyserNode;
    expect(readLevel(analyser, buffer)).toBe(0);
  });
});
