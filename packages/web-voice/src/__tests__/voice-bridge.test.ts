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
/** A second sentence, also long enough to clear the coalescing threshold. */
const SECOND =
  "Either party may terminate for convenience on ninety days written notice, and the " +
  "termination takes effect on the last day of the month in which that notice expires.";

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

describe("relay waiting acknowledgement", () => {
  it("suppresses progress when a primed answer is already streaming", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({ relayInterimResponse: { text: "One moment.", delayMs: 9000 } }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.primeAnswer("existing-answer");
    bridge.trackRelayRun("existing-question");
    bridge.trackAnswer("existing-answer", "The answer is arriving", false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(controls.sent).toHaveLength(0);
    session.disconnect();
    vi.useRealTimers();
  });

  it("describes current work, spaces changed updates, and stops when the answer arrives", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({
        relayInterimResponse: {
          text: "One moment.",
          delayMs: 8000,
          intervalMs: 18000,
          skipInitialResponse: true,
          describeActivity: ({ toolName, completed }) =>
            `${completed ? "Reviewing" : "Running"} ${toolName}.`,
        },
      }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("question");
    bridge.trackRelayActivity({ toolName: "workspace lookup", completed: false });
    await vi.advanceTimersByTimeAsync(7999);
    expect(controls.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(controls.sent.map(spokenText)).toEqual(["Running workspace lookup."]);
    bridge.handleServerEvent(responseDone);
    await vi.advanceTimersByTimeAsync(18000);
    expect(controls.sent).toHaveLength(1); // No repeated filler for unchanged activity.
    bridge.trackRelayActivity({ toolName: "document search", completed: true });
    await vi.advanceTimersByTimeAsync(17999);
    expect(controls.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(controls.sent.map(spokenText)).toEqual([
      "Running workspace lookup.",
      "Reviewing document search.",
    ]);
    bridge.handleServerEvent(responseDone);
    bridge.trackAnswer("answer", "Here is", false);
    bridge.trackRelayActivity({ toolName: "another lookup", completed: false });
    await vi.advanceTimersByTimeAsync(40000);
    expect(controls.sent).toHaveLength(2);
    session.disconnect();
    vi.useRealTimers();
  });

  it("does not restart activity updates after an interruption", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({
        relayInterimResponse: {
          text: "One moment.",
          delayMs: 8000,
          describeActivity: () => "Searching your workspace.",
        },
      }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("question");
    bridge.trackRelayActivity({ toolName: "search", completed: false });
    bridge.handleServerEvent(speechStarted);
    bridge.trackRelayActivity({ toolName: "search", completed: true });
    await vi.advanceTimersByTimeAsync(60000);
    expect(controls.sent).toHaveLength(0);
    session.disconnect();
    vi.useRealTimers();
  });

  it("lets the opening reply speak first and waits 15 seconds on subsequent turns", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({ relayInterimResponse: { text: "One moment.", skipInitialResponse: true } }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("greeting");
    await vi.advanceTimersByTimeAsync(30000);
    expect(controls.sent).toHaveLength(0);
    bridge.trackAnswer("hello", "Hello! How can I help?", true);
    bridge.handleServerEvent(responseDone);
    bridge.trackRelayRun(null);
    bridge.trackRelayRun("question");
    await vi.advanceTimersByTimeAsync(14999);
    expect(controls.sent.map(spokenText)).toEqual(["Hello! How can I help?"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(controls.sent.map(spokenText)).toEqual(["Hello! How can I help?", "One moment."]);
    session.disconnect();
    vi.useRealTimers();

    const secondCall = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("new-call-greeting");
    await vi.advanceTimersByTimeAsync(30000);
    expect(controls.sent).toHaveLength(2);
    secondCall.session.disconnect();
    vi.useRealTimers();
  });

  it("does not put a waiting message ahead of a buffered short answer", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(relay({ relayInterimResponse: { text: "One moment." } }));
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("question");
    await vi.advanceTimersByTimeAsync(14000);
    bridge.trackAnswer("answer", "Hello!", false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(controls.sent).toHaveLength(0);
    bridge.trackAnswer("answer", "Hello! How can I help?", true);
    expect(controls.sent.map(spokenText)).toEqual(["Hello! How can I help?"]);
    session.disconnect();
    vi.useRealTimers();
  });

  it("speaks once during a slow run and queues the real answer without losing it", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({ relayInterimResponse: { text: "One moment.", delayMs: 6500 } }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("question");
    await vi.advanceTimersByTimeAsync(6000);
    bridge.trackRelayRun("question"); // Streaming tool updates must not restart the delay.
    expect(controls.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(controls.sent.map(spokenText)).toEqual(["One moment."]);
    bridge.trackAnswer("answer", "Here is the result.", true);
    expect(controls.sent).toHaveLength(1);
    bridge.handleServerEvent(responseDone);
    expect(controls.sent.map(spokenText)).toEqual(["One moment.", "Here is the result."]);
    await vi.advanceTimersByTimeAsync(30000);
    expect(controls.sent).toHaveLength(2);
    session.disconnect();
    vi.useRealTimers();
  });

  it.each(["answer", "completed", "interrupted", "disconnected"] as const)(
    "cancels a pending acknowledgement when %s",
    async (reason) => {
      const controls = fakeControls();
      const bridge = new VoiceBridge(
        relay({ relayInterimResponse: { text: "One moment.", delayMs: 6500 } }),
      );
      const { session } = await connect(bridge, controls);
      vi.useFakeTimers();
      bridge.trackRelayRun("question");
      await vi.advanceTimersByTimeAsync(6000);
      if (reason === "answer") bridge.trackAnswer("answer", "The answer.", true);
      if (reason === "completed") bridge.trackRelayRun(null);
      if (reason === "interrupted") bridge.handleServerEvent(speechStarted);
      if (reason === "disconnected") session.disconnect();
      await vi.advanceTimersByTimeAsync(10000);
      expect(controls.sent.map(spokenText)).toEqual(reason === "answer" ? ["The answer."] : []);
      session.disconnect();
      vi.useRealTimers();
    },
  );

  it("allows a new acknowledgement for the next user turn", async () => {
    const controls = fakeControls();
    const bridge = new VoiceBridge(
      relay({ relayInterimResponse: { text: "One moment.", delayMs: 6500 } }),
    );
    const { session } = await connect(bridge, controls);
    vi.useFakeTimers();
    bridge.trackRelayRun("first");
    await vi.advanceTimersByTimeAsync(6500);
    bridge.handleServerEvent(responseDone);
    bridge.trackRelayRun(null);
    bridge.trackRelayRun("second");
    await vi.advanceTimersByTimeAsync(6500);
    expect(controls.sent.map(spokenText)).toEqual(["One moment.", "One moment."]);
    session.disconnect();
    vi.useRealTimers();
  });
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

    // Not asserted on `session.status`: assistant-ui hooks the abort signal to
    // `session.disconnect()`, which disposes the session, after which every
    // helper is a no-op and the status stays `starting` by its design. The
    // requirement that is ours is the transport — eventually, since it may
    // settle after the abort won the race, but never left live.
    await vi.waitFor(() => expect(controls.connected, "transport left live").toBe(false));
  });

  it("gives up on a connection that never settles", async () => {
    // The case awaiting-then-checking could not handle at all: a permission
    // prompt left open, or a transport that never resolves either way. The
    // abort was only observed AFTER that unbounded await, so the session hung
    // as "starting" for as long as the connect did — and could still come up
    // later with the runtime no longer holding any control over it.
    const controls = fakeControls();
    controls.connect = () => new Promise<void>(() => {}); // never settles
    // Counted, because "did the setup give up?" is only observable from here:
    // racing the abort takes the stalled transport down, awaiting it never
    // does. Without this the test passes either way, since a second session
    // works regardless of whether the first one is still hanging.
    let disconnects = 0;
    const stop = controls.disconnect;
    controls.disconnect = () => {
      disconnects += 1;
      stop();
    };

    const bridge = new VoiceBridge(relay());
    bridge.attach(controls);
    const abort = new AbortController();
    const session = bridge.createAdapter().connect({ abortSignal: abort.signal });

    abort.abort();

    // The observable requirement is not a status — assistant-ui freezes that
    // on abort — but that the BRIDGE is released rather than stuck waiting on
    // a promise that will never settle. Prove it by using it again: a second
    // call on the same bridge must connect and run.
    // The stalled transport is taken down rather than waited on.
    await vi.waitFor(() =>
      expect(disconnects, "stalled transport never released").toBeGreaterThan(0),
    );

    const healthy = fakeControls();
    bridge.attach(healthy);
    const next = bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(next.status.type).toBe("running"));
    expect(healthy.connected).toBe(true);
    expect(controls.connected, "the stalled transport must not have come up").toBe(false);
    void session;
  });

  it("ignores the completion of a response cancelled by barge-in", async () => {
    // Cancelling cannot unsend what is already on the wire, so the interrupted
    // response still reports `response.done` — usually after the NEXT answer
    // has started speaking. Released then, it frees an utterance while the
    // current one is still going and the two run together. Completions are
    // matched to the response they belong to by id.
    const bridge = new VoiceBridge(relay());
    const controls = fakeControls();
    await connect(bridge, controls);

    bridge.trackAnswer("a1", `${FIRST} ${SECOND}`, true);
    await vi.waitFor(() => expect(controls.sent.length).toBe(1));
    bridge.handleServerEvent({ type: "response.created", response: { id: "resp_A" } } as never);

    // Barge-in cancels A.
    bridge.handleServerEvent({ type: "input_audio_buffer.speech_started" } as never);
    expect(controls.cancelled).toBe(1);

    // A new answer starts speaking.
    bridge.trackAnswer("a2", `${FIRST} ${SECOND}`, true);
    await vi.waitFor(() => expect(controls.sent.length).toBe(2));
    bridge.handleServerEvent({ type: "response.created", response: { id: "resp_B" } } as never);
    const afterBStarted = controls.sent.length;

    // A's completion finally lands. It says nothing about B.
    bridge.handleServerEvent({ type: "response.done", response: { id: "resp_A" } } as never);
    expect(controls.sent.length, "a cancelled response released the next utterance").toBe(
      afterBStarted,
    );

    // B's own completion does release the next one.
    bridge.handleServerEvent({ type: "response.done", response: { id: "resp_B" } } as never);
    await vi.waitFor(() => expect(controls.sent.length).toBe(afterBStarted + 1));
  });

  it("ignores the completion of a response cancelled before it was acknowledged", async () => {
    // The SDK's own response gate names this window: between sending
    // `response.create` and receiving `response.created` the conversation
    // looks idle. Interrupt in there and there is no id to remember, so the
    // completion that eventually arrives looks like the NEXT answer's and
    // releases it early. Order on the wire is what closes it: the first
    // `response.created` after such a cancel names the cancelled response.
    const bridge = new VoiceBridge(relay());
    const controls = fakeControls();
    await connect(bridge, controls);

    bridge.trackAnswer("a1", `${FIRST} ${SECOND}`, true);
    await vi.waitFor(() => expect(controls.sent.length).toBe(1));

    // Barge-in BEFORE response.created has arrived for that utterance.
    bridge.handleServerEvent({ type: "input_audio_buffer.speech_started" } as never);
    expect(controls.cancelled).toBe(1);

    // Now the service acknowledges the response that was already cancelled.
    bridge.handleServerEvent({
      type: "response.created",
      response: { id: "resp_late" },
    } as never);

    // A new answer starts speaking.
    bridge.trackAnswer("a2", `${FIRST} ${SECOND}`, true);
    await vi.waitFor(() => expect(controls.sent.length).toBe(2));
    bridge.handleServerEvent({ type: "response.created", response: { id: "resp_B" } } as never);
    const afterBStarted = controls.sent.length;

    // The cancelled response finally completes. It must not release B's next.
    bridge.handleServerEvent({ type: "response.done", response: { id: "resp_late" } } as never);
    expect(controls.sent.length, "a pre-acknowledgement cancel leaked through").toBe(afterBStarted);

    bridge.handleServerEvent({ type: "response.done", response: { id: "resp_B" } } as never);
    await vi.waitFor(() => expect(controls.sent.length).toBe(afterBStarted + 1));
  });

  it("leaves nothing pending behind after a cancelled connect", async () => {
    // The cancellation branch used to leave `pendingConnect` set. A later
    // close then acted on the controls of a call that had already ended —
    // disconnecting a transport it did not own.
    const controls = fakeControls();
    let release: (() => void) | null = null;
    controls.connect = () =>
      new Promise<void>((resolve) => {
        release = () => resolve();
      });

    const bridge = new VoiceBridge(relay());
    bridge.attach(controls);
    const abort = new AbortController();
    bridge.createAdapter().connect({ abortSignal: abort.signal });
    await vi.waitFor(() => expect(release).not.toBeNull());

    abort.abort();
    release!();
    await vi.waitFor(() => expect(controls.connected).toBe(false));
    // Let the abort path's own late teardown finish first — counting from
    // before it lands would blame the stale-pending bug for a legitimate
    // disconnect and pass for the wrong reason.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    // The call is over. A later close must find nothing to act on.
    let disconnectsAfter = 0;
    const stop = controls.disconnect;
    controls.disconnect = () => {
      disconnectsAfter += 1;
      stop();
    };
    bridge.handleClosed();

    expect(disconnectsAfter, "a stale pending connect was acted on").toBe(0);
  });

  it("does not let a stale attempt erase a newer one's pending record", async () => {
    // The other half of the shared-flag bug: when the superseded connection
    // finally settles it used to clear `pendingConnect` unconditionally — the
    // record belonging to a NEWER attempt that was itself still connecting. A
    // later close then found nothing pending and left that transport coming up
    // with no host.
    const stale = fakeControls();
    let releaseStale: (() => void) | null = null;
    stale.connect = () =>
      new Promise<void>((resolve) => {
        releaseStale = () => resolve();
      });

    const fresh = fakeControls();
    let freshDisconnects = 0;
    const stopFresh = fresh.disconnect;
    fresh.disconnect = () => {
      freshDisconnects += 1;
      stopFresh();
    };
    let freshStarted = false;
    fresh.connect = () => {
      freshStarted = true;
      return new Promise<void>(() => {}); // still connecting
    };

    const bridge = new VoiceBridge(relay());
    bridge.attach(stale);
    bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(releaseStale).not.toBeNull());

    bridge.attach(fresh);
    bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(freshStarted).toBe(true));

    // The superseded one settles. It must not touch the newer attempt.
    releaseStale!();
    for (let i = 0; i < 10; i++) await Promise.resolve();

    bridge.handleClosed();

    expect(freshDisconnects, "the newer pending transport was left coming up").toBe(1);
  });

  it("does not let a superseded connection come up behind a newer call", async () => {
    // Abandonment used to be a boolean on the bridge, so starting a second
    // call reset it. If the FIRST transport then came up, its continuation saw
    // "not abandoned", marked itself connected and started its meter — a
    // microphone open with no host, and the newer attempt's pending record
    // cleared out from under it. The token makes each attempt answer only for
    // itself.
    const stale = fakeControls();
    let releaseStale: (() => void) | null = null;
    stale.connect = () =>
      new Promise<void>((resolve) => {
        releaseStale = () => {
          stale.connected = true;
          resolve();
        };
      });

    const bridge = new VoiceBridge(relay());
    bridge.attach(stale);
    const first = bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(releaseStale).not.toBeNull());

    // A second call supersedes it before the first transport ever came up.
    const fresh = fakeControls();
    bridge.attach(fresh);
    const second = bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(second.status.type).toBe("running"));

    // Only now does the stale transport finish connecting.
    releaseStale!();

    await vi.waitFor(() => expect(stale.connected, "a superseded mic went live").toBe(false));
    expect(first.status.type, "the superseded session started anyway").not.toBe("running");
    // The newer call is untouched by the old one settling.
    expect(second.status.type).toBe("running");
    expect(fresh.connected).toBe(true);
  });

  it("takes down a connection that never settles when the host leaves", async () => {
    // `setup` re-checks `abandoned` past its await, so a connection that
    // arrives late is already handled. The case that path cannot reach is the
    // one that never arrives — an unanswered permission prompt, a stalled
    // transport — where the await simply never returns. `handleClosed()`
    // returned early because `connected` was still false, and the transport
    // was left coming up with nothing able to stop it.
    const controls = fakeControls();
    let disconnects = 0;
    const stop = controls.disconnect;
    controls.disconnect = () => {
      disconnects += 1;
      stop();
    };
    let connectStarted = false;
    controls.connect = () => {
      connectStarted = true;
      return new Promise<void>(() => {}); // never settles
    };

    const bridge = new VoiceBridge(relay());
    const detach = bridge.attach(controls);
    const session = bridge.createAdapter().connect({});
    // `setup` awaits the host's controls before it calls connect(), so the
    // transport is not pending yet on the synchronous path.
    await vi.waitFor(() => expect(connectStarted).toBe(true));

    detach();
    bridge.handleClosed();

    expect(disconnects, "a transport that never settles was left coming up").toBe(1);

    // Stopping at the transport is not enough: the session itself has to end.
    // There is no abort signal here, so assistant-ui has NOT disposed it — the
    // helpers still work, and skipping them leaves it reporting `starting` for
    // ever while the runtime still believes a call is coming up.
    expect(session.status.type, "the session was left connecting for ever").toBe("ended");
  });

  it("does not start a session whose host left while it was connecting", async () => {
    // `connected` is only set once connect() resolves, so it is false both
    // BEFORE a call and DURING one that is still coming up — and only one of
    // those may go on to run. Unmounting in that window slipped past the
    // guard and left the pending setup free to mark itself running against
    // controls whose host no longer existed.
    const controls = fakeControls();
    let release: (() => void) | null = null;
    controls.connect = () =>
      new Promise<void>((resolve) => {
        release = () => {
          controls.connected = true;
          resolve();
        };
      });

    const bridge = new VoiceBridge(relay());
    const detach = bridge.attach(controls);
    const session = bridge.createAdapter().connect({});
    await vi.waitFor(() => expect(release).not.toBeNull());

    // The host unmounts: retract the controls and end the call.
    detach();
    bridge.handleClosed();

    // Only now does the transport finish coming up.
    release!();

    await vi.waitFor(() => expect(controls.connected, "transport left live").toBe(false));
    expect(session.status.type, "a session started without a host").not.toBe("running");
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
