/**
 * The one property that matters for streamed speech: **nothing is ever said
 * twice, and nothing is said out of order.**
 *
 * Worth a randomised test rather than more examples, because the bug this
 * caught was invisible to reasoning. An earlier design re-segmented the whole
 * answer on each update and diffed the utterance lists, on the assumption that
 * segmentation is prefix-stable. It is not: the `MAX_UTTERANCE_CHARS` cut is
 * speculative — it fires only because no sentence end is in sight — so when the
 * period finally arrives, that span re-segments as one long sentence, every
 * later utterance shifts, and the whole answer is spoken again. This test put
 * that failure rate at roughly two in three for long unpunctuated text; the
 * hand-written examples all passed.
 */
import { describe, expect, it } from "vitest";
import { SentenceStream, toSpeakableText } from "../adapter/speech-queue.ts";

/** Fixed seed: a failure here must be reproducible, not a flake. */
function makeRandom(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

const WORDS = (
  "the turbine governor must be recalibrated before acceptance testing begins and report " +
  "records every result in detail for client representative on site vibration levels " +
  "monitored continuously commissioning engineer duty"
).split(" ");
const ENDERS = [". ", "! ", "? ", "… ", '." ', ".) "];
const NOISE = [
  "",
  " **bold**",
  " `code`",
  " [1]",
  " [2, 3]",
  "\n- bullet",
  "\n# Heading",
  "\n> quote",
];

function makeAnswer(rnd: () => number, longRuns: boolean): string {
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;
  let text = "";
  const parts = 1 + Math.floor(rnd() * 5);
  for (let p = 0; p < parts; p++) {
    // Long runs with no terminator are what force the speculative MAX cut.
    const words = longRuns ? 60 + Math.floor(rnd() * 220) : 3 + Math.floor(rnd() * 30);
    for (let w = 0; w < words; w++) text += (w ? " " : "") + pick(WORDS);
    text += pick(NOISE);
    text += !longRuns || rnd() < 0.5 ? pick(ENDERS) : " ";
  }
  return text.trim();
}

/** Feed an answer in irregular chunks, the way tokens actually arrive. */
function speakIncrementally(answer: string, rnd: () => number): string[] {
  const stream = new SentenceStream();
  const spoken: string[] = [];
  let i = 0;
  while (i < answer.length) {
    i = Math.min(answer.length, i + 1 + Math.floor(rnd() * 20));
    spoken.push(...stream.push(toSpeakableText(answer.slice(0, i))));
  }
  spoken.push(...stream.flush());
  return spoken;
}

describe.each([
  ["long unpunctuated answers (forces the speculative cut)", true],
  ["ordinary mixed answers", false],
])("streaming %s", (_label, longRuns) => {
  // Enough to hit the cut path repeatedly; each trial streams an answer one
  // small chunk at a time, so the loop is deliberately heavy.
  const TRIALS = 150;
  const BUDGET_MS = 30_000;

  it("never speaks the same utterance twice", { timeout: BUDGET_MS }, () => {
    const rnd = makeRandom(24680);
    let sawCut = 0;
    for (let t = 0; t < TRIALS; t++) {
      const answer = makeAnswer(rnd, longRuns);
      const spoken = speakIncrementally(answer, rnd);
      if (spoken.some((u) => u.length > 230)) sawCut++;
      expect(new Set(spoken).size, `duplicate in: ${answer.slice(0, 120)}…`).toBe(spoken.length);
    }
    // The test is worthless if it never reaches the path that broke.
    if (longRuns) expect(sawCut).toBeGreaterThan(TRIALS / 2);
  });

  it("speaks the answer in order, reading no word twice", { timeout: BUDGET_MS }, () => {
    const rnd = makeRandom(13579);
    for (let t = 0; t < TRIALS; t++) {
      const answer = makeAnswer(rnd, longRuns);
      const spoken = speakIncrementally(answer, rnd).join(" ").replace(/\s+/g, " ").trim();
      const complete = toSpeakableText(answer).replace(/\s+/g, " ").trim();

      // Every spoken word must appear in the finished answer at or after the
      // previous one — the definition of "no repeats and no reordering".
      let at = 0;
      for (const word of spoken.split(" ").filter(Boolean)) {
        const found = complete.indexOf(word, at);
        expect(found, `"${word}" out of order in: ${answer.slice(0, 120)}…`).toBeGreaterThanOrEqual(
          0,
        );
        at = found + word.length;
      }
    }
  });
});
