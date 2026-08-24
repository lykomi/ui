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

/** Long enough to clear the coalescing threshold on its own. */
const FIRST =
  "The notice period is thirty days and it runs from the date on which the written notice is actually received by the other party, not the date it was sent.";

function spokenText(event: unknown): string {
  return (
    event as { response: { pre_generated_assistant_message: { content: { text: string }[] } } }
  ).response.pre_generated_assistant_message.content[0]!.text;
}

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

  it("ignores an empty final transcript from a VAD misfire", async () => {
    // Room noise, or the assistant's own tail on speakers, produces a final
    // transcript with nothing in it — an empty bubble that looks like a turn.
    const bridge = new VoiceBridge(realtime());
    const { transcripts } = await connect(bridge, fakeControls());

    bridge.handleTranscript("user", "   ", true);
    expect(transcripts).toEqual([]);

    bridge.handleTranscript("user", "a real question", true);
    expect(transcripts).toHaveLength(1);
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

  it("speaks the answer in chunks as it streams, not one sentence at a time", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    // Nothing yet: the sentence is unfinished, and `toSpeakableText` trims,
    // so a terminator at the very end never carries the following
    // whitespace that would prove it was one.
    bridge.trackAnswer("m1", FIRST.slice(0, 60), false);
    expect(controls.sent).toHaveLength(0);

    // Enough text to be worth a seam, mid-stream — speech starts before the
    // answer has finished arriving.
    bridge.trackAnswer("m1", `${FIRST} More`, false);
    expect(controls.sent).toHaveLength(1);
    expect(controls.sent[0]).toEqual({
      type: "response.create",
      response: {
        pre_generated_assistant_message: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: FIRST }],
        },
      },
    });

    // The remainder waits for the running response to finish.
    bridge.trackAnswer("m1", `${FIRST} More to say here at the end.`, true);
    expect(controls.sent).toHaveLength(1);
    bridge.handleServerEvent(responseDone);
    expect(controls.sent).toHaveLength(2);
    expect(spokenText(controls.sent[1])).toBe("More to say here at the end.");
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

  it("does not speak before the transport is actually connected", async () => {
    // `helpers` exists from the first line of setup, well before connect()
    // resolves. Speaking into that window loses the utterance AND wedges the
    // queue, because the response.done that would release it never comes.
    const controls = fakeControls();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slowControls = { ...controls, connect: () => gate };

    const bridge = new VoiceBridge(relay());
    bridge.attach(slowControls);
    bridge.createAdapter().connect({});
    await Promise.resolve();

    bridge.trackAnswer("m1", "Too early. ", true);
    expect(controls.sent).toHaveLength(0);

    // Once the transport is up the same answer is speakable again, so the
    // guard delays speech rather than dropping it on the floor.
    release();
    await vi.waitFor(() => expect(controls.sent).toHaveLength(0));
    bridge.trackAnswer("m2", "Now we are connected. ", true);
    await vi.waitFor(() => expect(controls.sent).toHaveLength(1));
  });

  it("does not read back the answer that was already on screen", async () => {
    // Connecting voice after reading a reply must not recite it.
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.primeAnswer("m1");
    bridge.trackAnswer("m1", "An answer from before voice was on. ", true);
    expect(controls.sent).toHaveLength(0);

    // The next answer is fair game again.
    bridge.trackAnswer("m2", "This one was asked by voice. ", true);
    expect(controls.sent).toHaveLength(1);
  });

  it("speaks a finished answer exactly once, however often the watcher fires", async () => {
    // The thread's message array gets a new identity on any notification,
    // so the watcher re-reports a completed answer repeatedly. This used to
    // look like a new answer each time and re-speak the whole reply, on a
    // loop that never ended.
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    const answer = "The notice period is thirty days. ";
    bridge.trackAnswer("m1", answer, true);
    bridge.handleServerEvent(responseDone);
    for (let i = 0; i < 5; i++) bridge.trackAnswer("m1", answer, true);
    bridge.handleServerEvent(responseDone);

    expect(controls.sent).toHaveLength(1);
  });

  it("does not re-speak an answer the user interrupted", async () => {
    // After barge-in the interrupted reply is still the last message, so the
    // watcher keeps reporting it.
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay());
    await connect(bridge, controls);

    bridge.trackAnswer("m1", `${FIRST} And`, false);
    expect(controls.sent).toHaveLength(1);

    bridge.handleServerEvent(speechStarted);
    bridge.trackAnswer("m1", `${FIRST} And a further sentence.`, true);
    bridge.handleServerEvent(responseDone);

    expect(controls.sent).toHaveLength(1);
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

  it("frees the speech queue when the transport dies mid-utterance", async () => {
    // The bridge is installed once for the life of the app, so its state
    // outlives a call. The speech queue releases on `response.done`, which a
    // dead transport will never send — left `speaking`, it swallows every
    // utterance of every LATER call: the next session connects, the agent
    // answers, and nothing is ever heard again. `disconnect()` always cleaned
    // up; a remote close did not, and that is the route on which the transport
    // dies mid-utterance.
    const bridge = new VoiceBridge(relay());
    const controls = fakeControls();
    await connect(bridge, controls);

    bridge.trackAnswer("a1", FIRST, true);
    await vi.waitFor(() => expect(controls.sent.length).toBeGreaterThan(0));
    const spokenBeforeDeath = controls.sent.length;

    // The transport dies without ever sending response.done.
    bridge.handleClosed();

    // A fresh call on the same bridge must speak again.
    const controls2 = fakeControls();
    await connect(bridge, controls2);
    bridge.trackAnswer("a2", FIRST, true);

    await vi.waitFor(() => expect(controls2.sent.length).toBeGreaterThan(0));
    expect(spokenBeforeDeath).toBeGreaterThan(0);
  });

  it("takes the transport down when the call is cancelled while connecting", async () => {
    // Cancelling after the host attached but before `connect()` resolves is
    // observed by nothing else: `awaitControls` has returned, `connect()` takes
    // no signal, and the cleanup that owns `controls.disconnect()` does not
    // exist yet. Unchecked, the transport that has just come up is marked
    // running on a session the runtime already discarded — microphone open,
    // no control able to close it.
    const controls = fakeControls();
    let releaseConnect: (() => void) | null = null;
    controls.connect = () =>
      new Promise<void>((resolve) => {
        // The transport DOES come up — that is the whole danger. It must then
        // be taken back down, which is what this test is for.
        releaseConnect = () => {
          controls.connected = true;
          resolve();
        };
      });

    const bridge = new VoiceBridge(relay());
    bridge.attach(controls);
    const abort = new AbortController();
    const session = bridge.createAdapter().connect({ abortSignal: abort.signal });

    await vi.waitFor(() => expect(releaseConnect).not.toBeNull());
    abort.abort();
    releaseConnect!();

    await vi.waitFor(() => expect(session.status.type).not.toBe("running"));
    expect(controls.connected, "transport must not be left live").toBe(false);
  });

  it("ends the session when the transport closes on its own", async () => {
    // `handleClosed` had no caller anywhere in the repo. After a clean remote
    // close or exhausted reconnects the SDK reaches `disconnected` without an
    // error, so nothing ended the adapter session: `connected` stayed true,
    // assistant-ui kept the voice session `running`, the controls kept showing
    // a live call, and relay answers were queued to a dead transport.
    const bridge = new VoiceBridge(relay());
    const { session } = await connect(bridge, fakeControls());
    expect(session.status.type).toBe("running");

    bridge.handleClosed();

    expect(session.status).toMatchObject({ type: "ended", reason: "finished" });
  });

  it("keeps a failure's reason when the close arrives after it", async () => {
    // Every route out of a call converges on `handleClosed`: an explicit
    // disconnect, a failure, and the surface observing `disconnected` all
    // arrive, so a close routinely follows an error. What must not happen is
    // the later close presenting as a clean finish and masking why the call
    // actually died.
    //
    // Note this pins the end-to-end contract, not the bridge's `connected`
    // guard on its own: assistant-ui's `end()` is itself once-only, so the
    // guard has no separately observable effect here (removing it leaves this
    // test green). It stays because the convergence above is real and the
    // bridge should not depend on the runtime's forgiveness for correctness.
    const onError = vi.fn();
    const bridge = new VoiceBridge(relay({ onError }));
    const { session } = await connect(bridge, fakeControls());

    bridge.handleError("WebSocket connection error");
    expect(session.status).toMatchObject({ type: "ended", reason: "error" });

    bridge.handleClosed();

    // Still the error, not overwritten by a "finished".
    expect(session.status).toMatchObject({ type: "ended", reason: "error" });
    expect(onError).toHaveBeenCalledTimes(1);
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
  /** The bridge's real provider: one buffer, resized only when fftSize changes. */
  function pool() {
    let buf: Uint8Array<ArrayBuffer> | null = null;
    const get = (size: number) => {
      if (buf === null || buf.length !== size) {
        buf = new Uint8Array(new ArrayBuffer(size));
        get.allocations++;
      }
      return buf;
    };
    get.allocations = 0;
    return get;
  }

  it("is zero without an analyser", () => {
    expect(readLevel(null, pool())).toBe(0);
  });

  it("reports peak deviation from silence, normalised", () => {
    const analyser = {
      fftSize: 4,
      getByteTimeDomainData: (b: Uint8Array) => b.set([128, 192, 128, 64]),
    } as unknown as AnalyserNode;
    expect(readLevel(analyser, pool())).toBeCloseTo(0.5, 5);
  });

  it("asks for a buffer the size of the analyser's window", () => {
    // The coupling this removes: a buffer sized by a constant of ours rather
    // than by the analyser reads only the oldest slice of a larger window and
    // under-reports the level. Nothing throws — `getByteTimeDomainData` drops
    // the excess per spec (verified in Chromium) — so the meter would just be
    // quietly wrong. The size must come from the analyser.
    const sizes: number[] = [];
    const analyser = {
      fftSize: 2048,
      getByteTimeDomainData: (b: Uint8Array) => b.fill(128),
    } as unknown as AnalyserNode;
    readLevel(analyser, (size) => {
      sizes.push(size);
      return new Uint8Array(new ArrayBuffer(size));
    });
    expect(sizes).toEqual([2048]);
  });

  it("reuses one buffer across ticks and reallocates only when fftSize changes", () => {
    // 20 reads a second for the length of a call: the reuse is the point of a
    // provider, and a resize must still be possible.
    const get = pool();
    const analyser = {
      fftSize: 256,
      getByteTimeDomainData: (b: Uint8Array) => b.fill(128),
    } as unknown as AnalyserNode;
    for (let i = 0; i < 10; i++) readLevel(analyser, get);
    expect(get.allocations).toBe(1);

    (analyser as { fftSize: number }).fftSize = 512;
    readLevel(analyser, get);
    expect(get.allocations).toBe(2);
  });

  it("never reads past the analyser's own sample count", () => {
    // A provider that hands back something larger than the window leaves stale
    // samples in the tail; reading them would report a level from a previous,
    // louder moment forever.
    const buffer = new Uint8Array(new ArrayBuffer(8));
    buffer.fill(255);
    const analyser = {
      fftSize: 2,
      getByteTimeDomainData: (b: Uint8Array) => {
        b[0] = 128;
        b[1] = 128;
      },
    } as unknown as AnalyserNode;
    expect(readLevel(analyser, () => buffer)).toBe(0);
  });
});
