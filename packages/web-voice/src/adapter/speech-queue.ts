/**
 * Turning a streaming markdown answer into spoken audio.
 *
 * Three separate problems, kept separate:
 *
 * 1. **What to say.** The agent writes markdown for a reader. Read aloud
 *    verbatim it becomes "asterisk asterisk important asterisk asterisk",
 *    and foundry's `[1]` citation markers become "bracket one". `toSpeakableText`
 *    strips the notation and keeps the prose.
 *
 * 2. **When to say it.** Waiting for the whole answer wastes the seconds the
 *    agent spends writing it. `SentenceStream` takes cumulative text and
 *    hands back complete sentences as they finish, so speech starts on the
 *    first full sentence.
 *
 * 3. **One at a time.** Voice Live rejects overlapping responses. The SDK's
 *    own `ResponseGate` serializes them, but it deliberately collapses
 *    everything queued during one response into a *single* follow-up — the
 *    right behaviour for turns, fatal for a sentence queue, where
 *    collapsing three pending sentences into one would drop two of them.
 *    `SpeechQueue` therefore keeps its own FIFO and releases the next
 *    utterance only once the previous response is done.
 */

/** Longest run of text spoken without a sentence end, before flushing at a word boundary. */
const MAX_UTTERANCE_CHARS = 240;

/** A sentence end: `.`, `!`, `?`, `…` (optionally closed by a quote/bracket) then whitespace. */
const SENTENCE_END = /([.!?…]["'”’)\]]*)(\s+)/;

const FENCED_CODE = /```[\s\S]*?(?:```|$)/g;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
/**
 * foundry citation markers — `[1]`, `[12]`, `[1, 3]` — are for the eye only.
 * The leading space goes with them: "net 30 [3]." must not be read as
 * "net 30 <pause> ." once the marker is gone.
 */
const CITATION = /[ \t]*\[\d+(?:\s*,\s*\d+)*\]/g;
const HEADING = /^\s{0,3}#{1,6}\s+/gm;
const BLOCKQUOTE = /^\s{0,3}>\s?/gm;
const LIST_BULLET = /^\s{0,3}([-*+]|\d+[.)])\s+/gm;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm;
const EMPHASIS = /(\*\*|__|\*|_|~~)/g;
const INLINE_CODE = /`([^`]*)`/g;
const TABLE_PIPES = /^\s*\|(.+)\|\s*$/gm;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]{3,}\|?\s*$/gm;

/**
 * Markdown → text a voice can read.
 *
 * Deliberately lossy: code blocks and table rules are dropped rather than
 * spelled out, because hearing punctuation read aloud is worse than not
 * hearing it at all. What survives is the prose.
 */
export function toSpeakableText(markdown: string): string {
  return markdown
    .replace(FENCED_CODE, " ")
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(CITATION, "")
    .replace(TABLE_DIVIDER, " ")
    .replace(TABLE_PIPES, "$1")
    .replace(RULE, " ")
    .replace(HEADING, "")
    .replace(BLOCKQUOTE, "")
    .replace(LIST_BULLET, "")
    .replace(INLINE_CODE, "$1")
    .replace(EMPHASIS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/**
 * Cuts cumulative streaming text into speakable utterances.
 *
 * Fed the *whole* answer so far on each call (which is what assistant-ui
 * exposes — parts carry cumulative text, not deltas) and returns only what
 * has not been emitted yet.
 */
export class SentenceStream {
  private consumed = 0;
  private buffer = "";

  /**
   * @param cumulative the full answer text so far
   * @returns complete utterances that became available with this update
   */
  push(cumulative: string): string[] {
    if (cumulative.length < this.consumed) {
      // The answer was replaced rather than extended (a retry, or a
      // messages-snapshot rewrite). Start over instead of emitting a
      // slice of the old text spliced onto the new.
      this.reset();
    }
    this.buffer += cumulative.slice(this.consumed);
    this.consumed = cumulative.length;
    return this.drain(false);
  }

  /** Emit whatever is left, complete sentence or not. Call when the answer ends. */
  flush(): string[] {
    const out = this.drain(true);
    const tail = this.buffer.trim();
    this.buffer = "";
    if (tail) out.push(tail);
    return out;
  }

  reset(): void {
    this.consumed = 0;
    this.buffer = "";
  }

  private drain(final: boolean): string[] {
    const out: string[] = [];
    for (;;) {
      const match = SENTENCE_END.exec(this.buffer);
      if (match) {
        const end = match.index + match[1].length;
        const utterance = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end + match[2].length);
        if (utterance) out.push(utterance);
        continue;
      }
      // No sentence end in sight. Once the buffer is long enough that
      // waiting would be a noticeable silence, cut at the last word
      // boundary — a long bulleted answer can run for a paragraph without
      // a single period.
      if (!final && this.buffer.length > MAX_UTTERANCE_CHARS) {
        const cut = this.buffer.lastIndexOf(" ", MAX_UTTERANCE_CHARS);
        if (cut <= 0) break;
        const utterance = this.buffer.slice(0, cut).trim();
        this.buffer = this.buffer.slice(cut + 1);
        if (utterance) out.push(utterance);
        continue;
      }
      break;
    }
    return out;
  }
}

/**
 * A strict FIFO of utterances, one on the wire at a time.
 *
 * `send` puts one utterance on the wire. `onResponseDone` must be called
 * when the service reports that response finished — that is the only thing
 * that releases the next one.
 */
export class SpeechQueue {
  private readonly pending: string[] = [];
  private speaking = false;

  constructor(private readonly send: (text: string) => void) {}

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  enqueue(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.pending.push(trimmed);
    this.pump();
  }

  /** The in-flight response finished; release the next utterance. */
  onResponseDone(): void {
    this.speaking = false;
    this.pump();
  }

  /**
   * Barge-in or a new turn: forget everything still queued.
   *
   * `speaking` is cleared too. The caller cancels the in-flight response on
   * the wire, and a cancelled response may never produce the `response.done`
   * that would otherwise release the queue — leaving it wedged shut for the
   * rest of the session.
   */
  cancel(): void {
    this.pending.length = 0;
    this.speaking = false;
  }

  private pump(): void {
    if (this.speaking) return;
    const next = this.pending.shift();
    if (next === undefined) return;
    this.speaking = true;
    this.send(next);
  }
}
