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
          await controls.connect();
          this.connected = true;

          // `createVoiceSession` starts every session in `starting`; nothing
          // else moves it on, so a session that never says `running` shows
          // as connecting forever.
          helpers.setStatus({ type: "running" });
          this.startVolumeMeter(controls);

          return {
            disconnect: () => {
              this.connected = false;
              this.userMuted = false;
              this.stopVolumeMeter();
              this.speech.cancel();
              this.sentences.reset();
              this.answerId = null;
              this.answerDone = false;
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
          this.speech.cancel();
          this.controls?.cancelResponse();
        }
        this.sentences.reset();
        this.answerDone = true;
        break;

      case "response.done":
        this.speech.onResponseDone();
        break;

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
    this.connected = false;
    this.config.onError?.(message);
    this.helpers?.end("error", new Error(message));
    this.stopVolumeMeter();
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
    if (!this.connected) return;
    this.connected = false;
    this.helpers?.end("finished");
    this.stopVolumeMeter();
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

    const speakable = toSpeakableText(text);
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
