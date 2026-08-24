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
/**
 * A bracketed run at the very end of the text — "[", "[2", "[2, 3", "[label]".
 *
 * The closing "]" is optional on purpose. A finished "[label]" sitting at the
 * end is not finished at all if the next character turns out to be "(", which
 * makes it a link and reduces it to "label" — four characters shorter. Waiting
 * for the next delta costs nothing, and speaking early costs a re-read.
 *
 * Anything still missing its "]" is unfinished by definition, since nothing
 * has arrived after it yet. Dropping it keeps normalisation MONOTONIC: a
 * half-arrived citation and the complete one reduce to the same text, so the
 * closing bracket changes nothing. Were only the complete form stripped, the
 * speakable text would SHORTEN as the raw answer grew, and any span already
 * voiced across it would have to be read a second time.
 *
 * Text that later turns out not to be a citation — "[note]", a markdown link —
 * simply reappears once it closes. Growth is harmless; only shrinkage forces
 * a rewind.
 */
const UNCLOSED_BRACKET = /[ \t]*\[[^\]]*\]?$/;
/**
 * A markdown link whose target is still arriving: "[label](http://ex" .
 *
 * The bracket is closed, so `UNCLOSED_BRACKET` does not apply, and `LINK`
 * needs the ")" before it can reduce the whole thing to its label — so in
 * between, the raw target leaks into the speakable text and then vanishes.
 * That is a shrink, and a shrink after the span has been voiced is a re-read.
 * Reduced to the label immediately instead, which is what it will become.
 *
 * The leading `!` is part of the match because an image is the same shape:
 * `IMAGE` reduces the finished `![alt](url)` to `alt`, so an incomplete one
 * that kept its `!` would shrink by that one character when the `)` landed.
 * One character is enough — the rewind is by utterance, not by character.
 */
const UNCLOSED_LINK = /!?\[([^\]]*)\]\([^)]*$/;
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
  return (
    markdown
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
      // Whatever backtick is left is unmatched — an inline-code span whose
      // closing tick has not arrived. Dropping it now means the arrival of that
      // tick changes nothing, which is the same monotonicity argument as above.
      .replace(/`/g, "")
      .replace(EMPHASIS, "")
      .replace(UNCLOSED_LINK, "$1")
      .replace(UNCLOSED_BRACKET, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim()
  );
}

/**
 * Cuts cumulative streaming text into speakable utterances.
 *
 * Fed the *whole* answer so far on each call (which is what assistant-ui
 * exposes — parts carry cumulative text, not deltas) and returns only what
 * has not been emitted yet.
 */
export class SentenceStream {
  /** How much of the answer has been turned into emitted utterances. */
  private consumed = 0;
  /** Exactly that prefix, kept so a rewrite of it can be detected. */
  private consumedText = "";
  /**
   * Every position an utterance has ended at, 0 first.
   *
   * A rewrite inside already-spoken text can only be repaired at one of these.
   * Rewinding to the raw point of divergence resumes mid-word — "…ly different
   * answer" — because the divergence lands wherever the two strings happen to
   * part, which is usually inside a word.
   */
  private boundaries: number[] = [0];
  /** The last cumulative answer seen, kept so `flush()` can finish it. */
  private text = "";

  /**
   * @param cumulative the full answer so far, already run through `toSpeakableText`
   * @returns complete utterances that became available with this update
   */
  push(cumulative: string): string[] {
    this.text = cumulative;

    // If the region already spoken has itself changed, rewind to where it
    // stopped matching — no further. A wholesale replacement diverges at the
    // start and rewinds to zero; a small edit re-speaks only from the edit.
    let same = 0;
    const limit = Math.min(this.consumedText.length, cumulative.length);
    while (same < limit && this.consumedText[same] === cumulative[same]) same++;
    if (same < this.consumed) {
      // Back to the last utterance that ended at or before the divergence, so
      // speech resumes on a seam the listener already heard end. A wholesale
      // replacement parts company almost immediately and finds only 0, which
      // is the whole answer again — correct, since none of it still stands.
      let at = 0;
      for (const b of this.boundaries) if (b <= same) at = b;
      this.boundaries = this.boundaries.filter((b) => b <= at);
      this.advanceTo(cumulative, at);
    }

    return this.take(segment(cumulative.slice(this.consumed), false), cumulative);
  }

  /** Emit whatever is left, complete sentence or not. Call when the answer ends. */
  flush(): string[] {
    return this.take(segment(this.text.slice(this.consumed), true), this.text);
  }

  reset(): void {
    this.consumed = 0;
    this.consumedText = "";
    this.text = "";
    this.boundaries = [0];
  }

  private take({ utterances, ends }: Segmented, source: string): string[] {
    if (ends.length === 0) return utterances;
    const base = this.consumed;
    for (const end of ends) this.boundaries.push(base + end);
    this.advanceTo(source, base + ends[ends.length - 1]!);
    return utterances;
  }

  private advanceTo(source: string, position: number): void {
    this.consumed = position;
    this.consumedText = source.slice(0, position);
  }
}

interface Segmented {
  utterances: string[];
  /**
   * Where each utterance ends, as an offset into the input — one per
   * utterance, so a later rewrite can rewind to any seam and not merely to
   * the end of the whole batch.
   */
  ends: number[];
}

/**
 * Split the UNSPOKEN remainder of an answer into utterances, reporting how
 * much of it was used.
 *
 * The reporting is the point. An earlier version re-segmented the whole answer
 * on every update and diffed the resulting lists, on the assumption that
 * segmentation is prefix-stable. It is not, and a property test over 3,000
 * randomised answers put the failure rate at roughly two in three for long
 * unpunctuated text. The `MAX_UTTERANCE_CHARS` cut below is a *speculative*
 * decision: it fires only because no sentence end is in sight yet. When the
 * period finally arrives, that same span re-segments as one long sentence
 * instead of the chunk that was already spoken, every later utterance shifts,
 * and the whole answer is said again.
 *
 * So nothing already spoken is ever reconsidered. The caller advances a
 * watermark by `consumed` and passes only what lies beyond it, which makes a
 * speculative cut permanent the moment it is voiced — as it must be, the audio
 * having already left.
 *
 * `final` means nothing more is coming, so the trailing fragment joins the last
 * group rather than becoming an utterance of its own.
 */
function segment(text: string, final: boolean): Segmented {
  const utterances: string[] = [];
  const ends: number[] = [];
  let pos = 0;
  // Complete sentences waiting to be grouped into one utterance.
  let group = "";
  const flushGroup = (end: number) => {
    if (!group) return;
    utterances.push(group);
    group = "";
    ends.push(end);
  };

  for (;;) {
    const rest = text.slice(pos);
    const match = SENTENCE_END.exec(rest);
    if (match) {
      const end = match.index + match[1].length;
      const utterance = rest.slice(0, end).trim();
      const next = pos + end + match[2].length;
      if (utterance) {
        group = group ? `${group} ${utterance}` : utterance;
        if (group.length >= MIN_UTTERANCE_CHARS) flushGroup(next);
      }
      pos = next;
      continue;
    }
    // No sentence end in sight. Once the remainder is long enough that waiting
    // would be a noticeable silence, cut at the last word boundary — a long
    // bulleted answer can run for a paragraph without a single period.
    if (!final && text.length - pos > MAX_UTTERANCE_CHARS) {
      const cut = text.lastIndexOf(" ", pos + MAX_UTTERANCE_CHARS);
      if (cut <= pos) break;
      const utterance = text.slice(pos, cut).trim();
      if (utterance) {
        group = group ? `${group} ${utterance}` : utterance;
        flushGroup(cut + 1);
      }
      pos = cut + 1;
      continue;
    }
    break;
  }

  if (final) {
    const tail = text.slice(pos).trim();
    if (tail) group = group ? `${group} ${tail}` : tail;
    flushGroup(text.length);
  }
  return { utterances, ends };
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
