/**
 * `VoiceBridge` — everything the voice tier does that is not React.
 *
 * It sits between two halves that cannot see each other:
 *
 *   - **assistant-ui**, which asks for a `RealtimeVoiceAdapter`: an
 *     imperative `connect()` returning a session that emits transcripts,
 *     mode, volume and status.
 *   - **the Voice Live SDK**, whose entry point is the `useVoiceLive` hook —
 *     a React object that only exists while a component is mounted.
 *
 * The join is `createVoiceSession(options, setup)`, whose `setup` is
 * **async**: `connect()` can return a session in the `starting` state
 * immediately and resolve the transport afterwards. So a render-less host
 * component owns the hook and calls `attach()` with its controls, and the
 * bridge's `connect()` simply awaits them. That reuses the SDK whole —
 * WebRTC, avatar, reconnect, the response gate, the tool round-trip —
 * instead of reimplementing a transport to satisfy an interface shape.
 *
 * The bridge holds no React component, hook or rendered state — the only
 * thing it takes from `@assistant-ui/react` is the voice contract itself
 * (`createVoiceSession`, the adapter types). So every rule below is driven
 * and asserted as a plain object against a fake transport, with no tree to
 * render and no session to connect.
 */

import { createVoiceSession, type RealtimeVoiceAdapter } from "@assistant-ui/react";
import type {
  VoiceLiveClientEvent,
  VoiceLiveServerEvent,
  SessionState,
} from "@iloveagents/foundry-voice-live-react";
import { SentenceStream, SpeechQueue, toSpeakableText } from "./speech-queue.ts";
import type { VoiceConfig, VoiceMode, VoiceTranscript } from "./types.ts";

/** What the bridge needs from the live session; supplied by the React host. */
export interface VoiceTransportControls {
  connect: () => Promise<void>;
  disconnect: () => void;
  mute: () => void;
  unmute: () => void;
  /** Put a client event on the wire. `response.create` is serialized by the SDK's response gate. */
  sendEvent: (event: VoiceLiveClientEvent) => void;
  /** Cancel the in-flight response and flush local playback (barge-in). */
  cancelResponse: () => void;
  /** Output analyser for a level meter, when the session exposes one. */
  getAnalyser: () => AnalyserNode | null;
}

/** How often the level meter samples, in ms. 20 Hz is smooth and cheap. */
const VOLUME_INTERVAL_MS = 50;

/** How long `connect()` waits for the host component to attach before giving up. */
const ATTACH_TIMEOUT_MS = 10_000;

type Unsubscribe = () => void;

export class VoiceBridge {
  private readonly mode: VoiceMode;
  private controls: VoiceTransportControls | null = null;
  private waiters: ((controls: VoiceTransportControls) => void)[] = [];

  private helpers: {
    setStatus: (status: RealtimeVoiceAdapter.Status) => void;
    end: (reason: "finished" | "cancelled" | "error", error?: unknown) => void;
    emitTranscript: (item: RealtimeVoiceAdapter.TranscriptItem) => void;
    emitMode: (mode: RealtimeVoiceAdapter.Mode) => void;
    emitVolume: (volume: number) => void;
    isDisposed: () => boolean;
  } | null = null;

  private connected = false;
  /**
   * The user's mute intent, as expressed through the runtime's controls.
   *
   * Distinct from the SDK's capture-mute state on purpose: half-duplex mutes
   * the SDK on its own behalf while the assistant speaks, and releasing that
   * mute must never override a mute the *user* asked for — that is how a
   * microphone ends up hot behind a UI that says muted.
   */
  private userMuted = false;
  /** An answer that was already on screen when voice connected — not ours to speak. */
  private skipAnswerId: string | null = null;
  private volumeTimer: ReturnType<typeof setInterval> | null = null;
  private volumeBuffer: Uint8Array<ArrayBuffer> | null = null;

  private readonly speech: SpeechQueue;
  private readonly sentences = new SentenceStream();
  /** Id of the assistant message currently being spoken, so a new answer resets the stream. */
  private answerId: string | null = null;
  /**
   * Whether `answerId` has been spoken to the end.
   *
   * The watcher re-fires for an answer that is already finished — the
   * thread's message array gets a new identity on any notification, not just
   * on new text. Without a "done" marker, clearing `answerId` on completion
   * made the very next tick look like a brand-new answer, reset the sentence
   * stream, and speak the whole reply again. Forever.
   */
  private answerDone = false;
  /** The response currently being spoken, once the service has named it. */
  private activeResponseId: string | null = null;
  /**
   * Responses cancelled by barge-in whose `response.done` has not arrived yet.
   *
   * Bounded by the number of interruptions in a call and cleared with it. A
   * cancelled response that never reports simply leaves an unused entry — the
   * alternative, counting completions to swallow, wedges the queue for the
   * rest of the session when the count is wrong.
   */
  private readonly cancelledResponses = new Set<string>();
  /**
   * A response was cancelled before the service had named it.
   *
   * The SDK's own gate documents the window: between sending `response.create`
   * and receiving `response.created` the conversation looks idle. Interrupting
   * in there leaves nothing to correlate, so the completion that eventually
   * arrives would look like the NEXT answer's and release it early — the same
   * bug, in the gap. The wire preserves order, so the first `response.created`
   * after such a cancel names the response that was cancelled.
   */
  private cancelledBeforeCreated = false;
  /**
   * The connection attempt currently allowed to become a session.
   *
   * A token per attempt, not a boolean on the bridge. A boolean is shared, so
   * starting a second call reset it — and if the FIRST transport then came up,
   * its continuation saw "not abandoned", marked itself connected, and left a
   * microphone open with no host, while also clearing the newer attempt's
   * pending record. Each attempt compares its own token, so an obsolete
   * continuation can never mistake a later call's state for permission.
   */
  private attempt: symbol | null = null;
  /**
   * A connection that has been asked for but has not settled.
   *
   * Held so that abandoning a call can take the transport down NOW rather than
   * waiting on a promise that may never resolve — a permission prompt left
   * open, a transport that stalls. `setup` re-checks its attempt token past
   * the await and covers a connection that arrives late; the case it cannot reach
   * is the one that never arrives, which is exactly this.
   */
  private pendingConnect: { controls: VoiceTransportControls } | null = null;

  /** Injected so the bridge never imports the React chat surface. */
  private submitText: ((text: string) => void) | null = null;

  constructor(private readonly config: VoiceConfig) {
    this.mode = config.mode ?? "relay";
    this.speech = new SpeechQueue((text) => this.sendSpokenText(text));
  }

  /**
   * True only once the transport is actually carrying a session.
   *
   * `helpers` exists from the first line of `setup`, which is *before*
   * `controls.connect()` resolves. Speaking in that window sends into a
   * socket that is not open yet: the utterance is lost, and because the
   * queue is now "speaking" it never receives the `response.done` that
   * would release it — the session goes silent for good.
   */
  private get isLive(): boolean {
    return this.connected && this.helpers !== null && !this.helpers.isDisposed();
  }

  /** The user's mute intent (see `userMuted`). Read by the half-duplex gate. */
  get isUserMuted(): boolean {
    return this.userMuted;
  }

  // ---- wiring ---------------------------------------------------------------

  /** The React host publishes its live controls here (and retracts them on unmount). */
  attach(controls: VoiceTransportControls): Unsubscribe {
    this.controls = controls;
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve(controls);
    return () => {
      if (this.controls === controls) this.controls = null;
    };
  }

  /** How the transcript reaches the composer in `relay` mode. */
  setSubmitText(submit: ((text: string) => void) | null): void {
    this.submitText = submit;
  }

  // ---- the assistant-ui contract --------------------------------------------

  createAdapter(): RealtimeVoiceAdapter {
    return {
      connect: ({ abortSignal }) =>
        createVoiceSession({ abortSignal }, async (helpers) => {
          this.helpers = helpers;
          const controls = await this.awaitControls(abortSignal);

          // Race the connection against cancellation rather than waiting it
          // out. `controls.connect()` takes no signal and is unbounded — a
          // permission prompt left open, a transport that never settles — and
          // until it resolves the cleanup that owns `controls.disconnect()`
          // does not exist. Awaiting first therefore left a discarded session
          // able to acquire the microphone minutes later with no control able
          // to stop it.
          const attempt = Symbol("voice-connect");
          this.attempt = attempt;
          const connecting = controls.connect();
          this.pendingConnect = { controls };
          if (abortSignal) {
            const cancelled = new Promise<"cancelled">((resolve) => {
              if (abortSignal.aborted) resolve("cancelled");
              else
                abortSignal.addEventListener("abort", () => resolve("cancelled"), { once: true });
            });
            const winner = await Promise.race([
              connecting.then(() => "connected" as const),
              cancelled,
            ]);
            if (winner === "cancelled") {
              // Take it down now in case it is already up, and again whenever
              // it finally settles — `disconnect()` on an idle transport is a
              // no-op, a live one left running is not.
              controls.disconnect();
              void connecting.then(
                () => controls.disconnect(),
                () => {},
              );
              this.endCall();
              // No `helpers.end()` here, and deliberately so: assistant-ui
              // registers `abort -> session.disconnect() -> cleanup()`, which
              // marks the session disposed, and every helper is a no-op after
              // that. The status stays `starting` for ever by ITS design, not
              // ours. What is ours is releasing the bridge so the next call
              // starts clean, and making sure the transport cannot outlive
              // this one. Throwing settles `setup` so nothing waits on it.
              throw abortSignal.reason instanceof Error
                ? abortSignal.reason
                : new Error("Voice connection cancelled");
            }
          } else {
            await connecting;
          }

          if (this.attempt === attempt) this.pendingConnect = null;
          if (this.attempt !== attempt) {
            // Abandoned: the host went away, or a newer call superseded this
            // one. Either way nothing remains that would control this
            // transport, so it must not become a live session. `endCall()` is
            // NOT called here — a newer attempt may already own the bridge,
            // and tearing its state down is exactly the confusion a shared
            // flag caused.
            controls.disconnect();
            throw new Error("Voice connection superseded before it completed");
          }

          this.connected = true;

          // `createVoiceSession` starts every session in `starting`; nothing
          // else moves it on, so a session that never says `running` shows
          // as connecting forever.
          helpers.setStatus({ type: "running" });
          this.startVolumeMeter(controls);

          return {
            disconnect: () => {
              this.endCall();
              controls.disconnect();
            },
            mute: () => {
              this.userMuted = true;
              controls.mute();
            },
            unmute: () => {
              this.userMuted = false;
              controls.unmute();
            },
          };
        }),
    };
  }

  // ---- fed by the React host ------------------------------------------------

  /**
   * A transcript line from the SDK (`text` is cumulative for the turn).
   *
   * The modes diverge here, and the divergence is the whole reason a spoken
   * turn in `relay` renders as an ordinary, persisted thread turn:
   *
   * - `realtime` republishes both roles, and assistant-ui materialises them
   *   as (session-scoped) thread messages.
   * - `relay` republishes **neither**. The user's words become a real
   *   message by going through the composer, and the answer is a real AG-UI
   *   turn. Emitting the transcript as well would render each of them
   *   twice.
   */
  handleTranscript(role: "user" | "assistant", text: string, isFinal: boolean): void {
    this.config.onTranscript?.({ role, text, isFinal } satisfies VoiceTranscript);

    if (this.mode === "realtime") {
      // A VAD misfire (room noise, the assistant's own tail) produces a
      // final user transcript with nothing in it. Publishing it puts an
      // empty bubble in the thread and makes the run look like a turn the
      // user took.
      if (!(role === "user" && isFinal && !text.trim())) {
        this.helpers?.emitTranscript({ role, text, isFinal });
      }
      return;
    }

    if (role === "user" && isFinal) {
      const spoken = text.trim();
      // A VAD false-positive produces an empty final transcript. Submitting
      // it would post a blank user turn and run the agent on nothing.
      if (spoken) this.submitText?.(spoken);
    }
  }

  /** Raw server events — only the few that drive turn-taking are read. */
  handleServerEvent(event: VoiceLiveServerEvent): void {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        // Barge-in. Drop everything still queued to be spoken; the wire's
        // in-flight response is cancelled by the service (`interrupt_response`),
        // and cancelling locally flushes playback that is already buffered.
        if (this.speech.isSpeaking || this.speech.pendingCount > 0) {
          // Remember what was in flight. Cancelling cannot unsend what is
          // already on the wire, so that response still reports `response.done`
          // — usually after the NEXT answer has started speaking. Released
          // then, it frees an utterance while the current one is still going
          // and the two run together.
          if (this.activeResponseId) {
            this.cancelledResponses.add(this.activeResponseId);
          } else if (this.speech.isSpeaking) {
            // Sent, not yet acknowledged: claim the id when it arrives.
            this.cancelledBeforeCreated = true;
          }
          this.activeResponseId = null;
          this.speech.cancel();
          this.controls?.cancelResponse();
        }
        this.sentences.reset();
        this.answerDone = true;
        break;

      case "response.created": {
        const created = responseIdOf(event);
        if (this.cancelledBeforeCreated) {
          this.cancelledBeforeCreated = false;
          if (created) this.cancelledResponses.add(created);
          break;
        }
        this.activeResponseId = created;
        break;
      }

      case "response.done": {
        const id = responseIdOf(event);
        // Only the response we are actually waiting on releases the queue.
        if (id && this.cancelledResponses.delete(id)) break;
        if (id && this.activeResponseId === id) this.activeResponseId = null;
        this.speech.onResponseDone();
        break;
      }

      default:
        break;
    }
  }

  /** SDK session state → assistant-ui's two-value mode. */
  handleSessionState(state: SessionState): void {
    this.helpers?.emitMode(state === "speaking" ? "speaking" : "listening");
  }

  /** A session-fatal error: report it, and end the session so the UI leaves the live state. */
  handleError(message: string): void {
    this.endCall();
    this.config.onError?.(message);
    this.helpers?.end("error", new Error(message));
  }

  /**
   * The transport reached a terminal closed state.
   *
   * Idempotent by the `connected` check, because every route out of a call
   * ends here: an explicit `disconnect()`, a failure through `handleError`,
   * and the surface observing `connectionState === "disconnected"` all arrive,
   * and ending the session twice would be a second `end()` on a session that
   * already finished.
   */
  handleClosed(): void {
    // `connected` is only true once `connect()` resolves, so it cannot tell
    // "no call yet" from "a call still coming up" — and only the second of
    // those has anything to tear down.
    this.attempt = null;

    // A connection may still be on its way up with nothing left to control it.
    // Take it down now; one that resolves LATER is caught inside `setup`,
    // which re-checks `abandoned` past its await. The case that path cannot
    // reach is the one that never resolves at all, which is this.
    const pending = this.pendingConnect;
    if (pending) {
      this.pendingConnect = null;
      pending.controls.disconnect();
    }

    // Everything below runs for an abandoned setup too. Stopping at the
    // transport left the session in `starting` for ever and the speech queue
    // holding whatever it held, which then swallowed the next call — the very
    // failure `endCall()` exists to prevent, reintroduced by an early return.
    if (!this.connected && !pending) return;
    this.endCall();
    this.helpers?.end("finished");
  }

  /**
   * Everything a finished call must let go of, whichever way it ended.
   *
   * This bridge is installed once for the life of the app, so its state
   * outlives any single call. The speech queue is the dangerous part: it
   * releases on `response.done`, and a transport that has died will never send
   * one. Left `speaking`, it swallows every utterance of every LATER call —
   * the session connects, the agent answers, and nothing is ever heard again.
   *
   * `disconnect()` always did this; an error or a remote close did not, which
   * is exactly the pair of routes on which the transport dies mid-utterance.
   */
  private endCall(): void {
    this.connected = false;
    // Cleared here rather than on each exit path: the cancellation branch left
    // it set, and a later `handleClosed()` would then act on the controls of a
    // call that ended long ago — disconnecting a transport it does not own and
    // ending a session it did not start.
    this.pendingConnect = null;
    this.activeResponseId = null;
    this.cancelledResponses.clear();
    this.cancelledBeforeCreated = false;
    this.userMuted = false;
    this.stopVolumeMeter();
    this.speech.cancel();
    this.sentences.reset();
    this.answerId = null;
    this.answerDone = false;
  }

  // ---- relay: speak the agent's answer --------------------------------------

  /**
   * Track the assistant answer as it streams and speak it sentence by
   * sentence. `relay` only — in `realtime` the model is already speaking.
   *
   * @param messageId identity of the answer; a change resets the stream
   * @param text cumulative answer text so far (markdown)
   * @param isComplete the turn has settled
   */
  /**
   * Mark an answer as already-delivered, so connecting voice does not read
   * the last thing on screen back to the user. Called by the relay watcher
   * the moment the session goes live.
   */
  primeAnswer(messageId: string | null): void {
    this.skipAnswerId = messageId;
  }

  trackAnswer(messageId: string, text: string, isComplete: boolean): void {
    // The watcher is mounted for the whole app lifetime, but an answer is
    // only spoken while a voice session is actually live — otherwise every
    // typed conversation would queue speech at a disconnected transport.
    if (this.mode !== "relay" || !this.isLive) return;
    if (messageId === this.skipAnswerId) return;

    if (this.answerId !== messageId) {
      this.answerId = messageId;
      this.answerDone = false;
      this.sentences.reset();
    } else if (this.answerDone) {
      // Already spoken in full; later ticks for it carry no new words.
      return;
    }

    // Once the answer has settled, nothing can still change a trailing
    // bracket, so it must not be held back — holding it at that point drops
    // it, since `flush()` sees only what was pushed.
    const speakable = toSpeakableText(text, { final: isComplete });
    for (const utterance of this.sentences.push(speakable)) this.speech.enqueue(utterance);

    if (isComplete) {
      for (const utterance of this.sentences.flush()) this.speech.enqueue(utterance);
      this.answerDone = true;
    }
  }

  /**
   * Speak exact text through Voice Live without invoking its model.
   *
   * `pre_generated_assistant_message` is the documented way to do this, and
   * it is what keeps the avatar's lip-sync and the chosen Azure voice while
   * the words come from somewhere else entirely. Sent through the SDK's
   * `sendEvent`, which routes a raw `response.create` through the same
   * response gate as every other turn.
   */
  private sendSpokenText(text: string): void {
    this.controls?.sendEvent({
      type: "response.create",
      response: {
        pre_generated_assistant_message: {
          type: "message",
          role: "assistant",
          content: [{ type: "text", text }],
        },
      },
    } as VoiceLiveClientEvent);
  }

  // ---- internals ------------------------------------------------------------

  private awaitControls(abortSignal?: AbortSignal): Promise<VoiceTransportControls> {
    if (this.controls) return Promise.resolve(this.controls);
    return new Promise<VoiceTransportControls>((resolve, reject) => {
      const timer = setTimeout(() => {
        remove();
        reject(
          new Error(
            "Voice session host is not mounted. Render <FoundryVoice /> inside the assistant runtime, or register the module with bootstrapShell.",
          ),
        );
      }, ATTACH_TIMEOUT_MS);

      const onAbort = () => {
        remove();
        reject(new Error("Voice connection aborted."));
      };

      const settle = (controls: VoiceTransportControls) => {
        remove();
        resolve(controls);
      };

      const remove = () => {
        clearTimeout(timer);
        abortSignal?.removeEventListener("abort", onAbort);
        this.waiters = this.waiters.filter((w) => w !== settle);
      };

      abortSignal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(settle);
    });
  }

  private startVolumeMeter(controls: VoiceTransportControls): void {
    this.stopVolumeMeter();
    this.volumeTimer = setInterval(() => {
      const helpers = this.helpers;
      if (!helpers || helpers.isDisposed()) {
        this.stopVolumeMeter();
        return;
      }
      helpers.emitVolume(
        readLevel(controls.getAnalyser(), (size) => this.ensureVolumeBuffer(size)),
      );
    }, VOLUME_INTERVAL_MS);
  }

  private ensureVolumeBuffer(size: number): Uint8Array<ArrayBuffer> {
    // Reused across ticks: allocating a fresh array 20× a second for the
    // life of a call is pure garbage-collector pressure. Sized from the
    // analyser rather than a constant of our own — the SDK pins fftSize to
    // 256 today, and a buffer that quietly disagreed with it would read only
    // the oldest slice of each window and under-report the level, with
    // nothing failing to make that visible.
    if (this.volumeBuffer === null || this.volumeBuffer.length !== size) {
      this.volumeBuffer = new Uint8Array(new ArrayBuffer(size));
    }
    return this.volumeBuffer;
  }

  private stopVolumeMeter(): void {
    if (this.volumeTimer === null) return;
    clearInterval(this.volumeTimer);
    this.volumeTimer = null;
  }
}

/**
 * Peak deviation from silence across the analyser's time-domain samples,
 * normalised to 0…1.
 *
 * The analyser the SDK exposes is on the **output** graph, so this is the
 * assistant's speaking level, not the microphone's — the honest meaning of
 * the number a consumer reads from `useVoiceVolume()`.
 */
/** The response id on a `response.created` / `response.done` event, if present. */
function responseIdOf(event: unknown): string | null {
  const response = (event as { response?: { id?: unknown } }).response;
  return typeof response?.id === "string" ? response.id : null;
}

export function readLevel(
  analyser: AnalyserNode | null,
  getBuffer: (size: number) => Uint8Array<ArrayBuffer>,
): number {
  if (!analyser) return 0;
  const buffer = getBuffer(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  // A provider may still hand back something larger; the tail of an oversized
  // buffer holds samples the analyser did not overwrite.
  const samples = Math.min(buffer.length, analyser.fftSize);
  let peak = 0;
  for (let i = 0; i < samples; i++) {
    const deviation = Math.abs(buffer[i]! - 128);
    if (deviation > peak) peak = deviation;
  }
  return Math.min(1, peak / 128);
}
