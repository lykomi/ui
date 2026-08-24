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

/**
 * Shortest utterance worth sending on its own.
 *
 * Every utterance is a separate synthesis: the player's queue drains to
 * empty between them, and the seam is audible as a click — with an avatar,
 * a visible restart too. Speaking each sentence the instant it lands turns a
 * four-sentence answer into four seams. Complete sentences are therefore
 * grouped until they are worth the seam, which still starts the audio well
 * before the answer has finished streaming.
 */
const MIN_UTTERANCE_CHARS = 140;

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
  /** Utterances already handed out, in order. */
  private emitted: string[] = [];
  /** The last cumulative answer seen, kept so `flush()` can re-segment it. */
  private text = "";

  /**
   * @param cumulative the full answer so far, already run through `toSpeakableText`
   * @returns complete utterances that became available with this update
   */
  push(cumulative: string): string[] {
    this.text = cumulative;
    return this.take(segment(cumulative, false));
  }

  /** Emit whatever is left, complete sentence or not. Call when the answer ends. */
  flush(): string[] {
    return this.take(segment(this.text, true));
  }

  reset(): void {
    this.emitted = [];
    this.text = "";
  }

  /**
   * Hand out whatever the new segmentation has beyond what was already said.
   *
   * The whole answer is re-segmented on every update rather than appended to
   * incrementally, because the text this receives is *normalised* and
   * normalisation is not monotonic: `toSpeakableText` keeps a half-arrived
   * citation ("[1") and strips the complete one ("[1]"), so the speakable text
   * gets SHORTER as the raw answer grows. A model that measured progress by
   * length read that shrink as "the answer was replaced", started over, and
   * spoke every sentence a second time — a repeat with no bad state anywhere
   * to point at.
   *
   * Re-segmenting is safe because it is prefix-stable: how a span is grouped
   * depends only on the text before it, so already-spoken utterances stay a
   * prefix and only genuinely new ones come out.
   *
   * What comes out is everything past the longest common prefix, which is the
   * whole story for all three cases. A tail edit shares the entire prefix and
   * yields nothing. A wholesale replacement (a retry, or a messages-snapshot
   * rewrite) shares none and yields the new answer entire. A revision partway
   * in yields only the part that actually changed — where a reset-and-restart
   * rule would re-say an opening that was still perfectly correct.
   */
  private take(all: string[]): string[] {
    let same = 0;
    while (same < this.emitted.length && same < all.length && this.emitted[same] === all[same]) {
      same++;
    }
    this.emitted = all;
    return all.slice(same);
  }
}

/**
 * Split speakable text into utterances. Pure: the same text always segments
 * the same way, which is what lets `SentenceStream` re-run it per update.
 *
 * `final` means nothing more is coming, so the trailing fragment joins the
 * last group rather than becoming an utterance of its own — an answer never
 * ends on a needless extra seam.
 */
function segment(text: string, final: boolean): string[] {
  const out: string[] = [];
  let buffer = text;
  // Complete sentences waiting to be grouped into one utterance.
  let group = "";
  const flushGroup = () => {
    if (group) out.push(group);
    group = "";
  };
  for (;;) {
    const match = SENTENCE_END.exec(buffer);
    if (match) {
      const end = match.index + match[1].length;
      const utterance = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + match[2].length);
      if (utterance) {
        group = group ? `${group} ${utterance}` : utterance;
        if (group.length >= MIN_UTTERANCE_CHARS) flushGroup();
      }
      continue;
    }
    // No sentence end in sight. Once the buffer is long enough that waiting
    // would be a noticeable silence, cut at the last word boundary — a long
    // bulleted answer can run for a paragraph without a single period.
    if (!final && buffer.length > MAX_UTTERANCE_CHARS) {
      const cut = buffer.lastIndexOf(" ", MAX_UTTERANCE_CHARS);
      if (cut <= 0) break;
      const utterance = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (utterance) {
        group = group ? `${group} ${utterance}` : utterance;
        flushGroup();
      }
      continue;
    }
    break;
  }

  if (final) {
    const tail = buffer.trim();
    if (tail) group = group ? `${group} ${tail}` : tail;
    flushGroup();
  }
  return out;
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
