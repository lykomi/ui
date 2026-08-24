import { describe, expect, it, vi } from "vitest";
import { SentenceStream, SpeechQueue, toSpeakableText } from "../adapter/speech-queue.ts";

describe("toSpeakableText", () => {
  it("drops the notation and keeps the prose", () => {
    const md = [
      "## Findings",
      "",
      "The **contract** says _thirty_ days.",
      "",
      "- First `item`",
      "- Second item",
      "",
      "See [the clause](https://example.com/clause) for detail.",
    ].join("\n");

    const spoken = toSpeakableText(md);

    expect(spoken).toContain("Findings");
    expect(spoken).toContain("The contract says thirty days.");
    expect(spoken).toContain("First item");
    expect(spoken).toContain("See the clause for detail.");
    expect(spoken).not.toMatch(/[#*_`\[\]()]/);
    expect(spoken).not.toContain("https://example.com/clause");
  });

  it("removes citation markers, which are for the eye only", () => {
    // Read aloud, "[3]" becomes "bracket three" in the middle of a sentence.
    expect(toSpeakableText("Payment is net 30 [3].")).toBe("Payment is net 30.");
    expect(toSpeakableText("Both clauses agree [1, 2] here.")).toBe("Both clauses agree here.");
  });

  it("drops fenced code rather than spelling it out", () => {
    const md = "Run this:\n\n```bash\nrm -rf / --no-preserve-root\n```\n\nThen restart.";
    const spoken = toSpeakableText(md);
    expect(spoken).toContain("Run this:");
    expect(spoken).toContain("Then restart.");
    expect(spoken).not.toContain("rm -rf");
  });

  it("keeps an unterminated code fence from swallowing nothing but itself", () => {
    // Mid-stream the closing fence has not arrived yet.
    expect(toSpeakableText("Here you go:\n```ts\nconst a = 1")).toBe("Here you go:");
  });

  it("reads a table as its cells, not its rules", () => {
    const md = "| Term | Value |\n| --- | --- |\n| Notice | 30 days |";
    const spoken = toSpeakableText(md);
    expect(spoken).toContain("Notice");
    expect(spoken).toContain("30 days");
    expect(spoken).not.toContain("---");
  });
});

describe("SentenceStream", () => {
  it("reads a markdown image the same before and after its target closes", () => {
    // Same shape as the link, one character apart: the completed IMAGE rule
    // reduces "![alt](url)" to "alt", so an incomplete one that kept its "!"
    // would shrink by exactly that character when the ")" landed. One
    // character is enough — the rewind is by utterance, not by character.
    const before = toSpeakableText("Figure ![the governor housing](https://example.inva");
    const after = toSpeakableText("Figure ![the governor housing](https://example.invalid/g.png)");
    expect(before).toBe(after);
    expect(after).toBe("Figure the governor housing");
  });

  it("reads a markdown link the same before and after its target closes", () => {
    // The bracket is already closed, so the unclosed-bracket rule does not
    // apply, and LINK needs the ")" before it can reduce to the label — so in
    // between, the raw URL leaks into the speakable text and then vanishes.
    const before = toSpeakableText("See the [commissioning log](https://example.inva");
    const after = toSpeakableText("See the [commissioning log](https://example.invalid/x)");
    expect(before).toBe(after);
    expect(after).toBe("See the commissioning log");
  });

  it("reads a citation the same before and after its bracket closes", () => {
    // Monotonicity, stated directly: a half-arrived citation and the complete
    // one must normalise to the SAME text. If only the complete form were
    // stripped, the speakable text would shrink as the raw answer grew, and
    // any span already voiced across it would have to be read again.
    const before = toSpeakableText("Clause four applies to the works [12, 34");
    const after = toSpeakableText("Clause four applies to the works [12, 34]");
    expect(before).toBe(after);
    expect(after).toBe("Clause four applies to the works");
  });

  it("reads an inline-code span the same before and after its closing tick", () => {
    const before = toSpeakableText("Call `configureGovernor(alpha, beta)");
    const after = toSpeakableText("Call `configureGovernor(alpha, beta)`");
    expect(before).toBe(after);
  });

  it("never shortens as a streamed answer grows", () => {
    // The property both of the above serve. Checked character by character,
    // because the shrink that caused a repeat was four characters wide.
    const answer =
      "Clause four applies to the whole of the works [12, 34] and to `everyPart(x)` of them.";
    let previous = "";
    for (let i = 1; i <= answer.length; i++) {
      const current = toSpeakableText(answer.slice(0, i));
      expect(current.length, `shrank at character ${i}`).toBeGreaterThanOrEqual(previous.length);
      previous = current;
    }
  });

  it("does not re-speak when a streaming citation completes", () => {
    // The failure: `toSpeakableText` keeps a half-arrived citation ("[1") and
    // strips the complete one ("[1]"), so the SPEAKABLE text gets shorter as
    // the raw answer grows. The old length-delta model read that shrink as a
    // replacement, reset, and spoke every finished sentence a second time —
    // a repeat with no bad state anywhere to point at. This is the bridge's
    // exact call shape: normalise, then push.
    const stream = new SentenceStream();
    const spoken: string[] = [];
    const feed = (raw: string) => spoken.push(...stream.push(toSpeakableText(raw)));

    const head =
      "The turbine governor must be recalibrated before the acceptance test begins, " +
      "and the report has to record the result. Next sentence here to force a flush.";

    feed(head);
    feed(`${head} More text [1`);
    const afterOpenBracket = [...spoken];
    expect(afterOpenBracket.length).toBeGreaterThan(0);

    feed(`${head} More text [1]`);
    // The citation closing must add nothing: the same sentences, said once.
    expect(spoken).toEqual(afterOpenBracket);
  });

  it("speaks a wholesale replacement in full", () => {
    // The behaviour the old length check existed for: a retry or a snapshot
    // rewrite shares no opening with what was already said, so all of it is new.
    const stream = new SentenceStream();
    const first = stream.push(
      "A complete first answer that is deliberately written long enough on its own " +
        "to clear the coalescing threshold without any help from what follows it. " +
        "And a second sentence.",
    );
    expect(first.length).toBeGreaterThan(0);

    const replaced = stream.push(
      "A completely different answer that shares no opening at all with the first " +
        "one and is likewise long enough on its own to clear that same threshold. " +
        "And its own second sentence.",
    );
    expect(replaced.length).toBeGreaterThan(0);
    expect(replaced[0]).not.toEqual(first[0]);
  });

  it("re-says nothing that is still correct when the answer is revised partway in", () => {
    // The case a reset-and-restart rule got wrong. Both sentences below clear
    // MIN_UTTERANCE_CHARS on their own, so pass one emits TWO utterances; the
    // revision then changes only the second. Restarting from zero on a prefix
    // that merely got shorter would re-say the opening the user already heard
    // — the same audible bug as the citation case by a different route. The
    // two-utterance shape is what makes this distinguishable at all: with a
    // single emitted utterance both rules agree.
    const opening =
      "The acceptance test has to be witnessed by the client representative on site, " +
      "and the witnessing has to be recorded in the commissioning log with meter readings.";
    const tail =
      "while the vibration levels are monitored continuously by the commissioning engineer on duty.";
    const closing = "And a closing sentence.";

    const stream = new SentenceStream();
    const firstPass = stream.push(
      `${opening} The turbine must then be run at partial load for one full hour ${tail} ${closing}`,
    );
    expect(firstPass).toHaveLength(2);

    const revised = stream.push(
      `${opening} The turbine must then be run at full load for two hours instead ${tail} ${closing}`,
    );
    expect(revised).toHaveLength(1);
    expect(revised[0]).toContain("full load for two hours");
    for (const utterance of revised) {
      expect(utterance).not.toContain("witnessed by the client representative");
    }
  });

  // Utterances are grouped to at least ~140 chars, because each one is a
  // separate synthesis and every boundary is an audible seam.
  const LONG =
    "The notice period is thirty days and it runs from the date the written notice is actually received by the other party, not the date on which it was sent.";

  it("groups short sentences instead of speaking each one", () => {
    const s = new SentenceStream();
    // Three short sentences, none worth a seam on its own.
    expect(s.push("One. Two. Three. ")).toEqual([]);
    expect(s.flush()).toEqual(["One. Two. Three."]);
  });

  it("emits as soon as a group is long enough to be worth the seam", () => {
    const s = new SentenceStream();
    // Each of these already clears the threshold on its own.
    expect(s.push(`${LONG} ${LONG} tail`)).toEqual([LONG, LONG]);
    expect(s.flush()).toEqual(["tail"]);
  });

  it("emits each group once as cumulative text grows", () => {
    const s = new SentenceStream();
    expect(s.push(LONG)).toEqual([]);
    // The terminator needs following whitespace before it counts.
    expect(s.push(`${LONG} `)).toEqual([LONG]);
    expect(s.push(`${LONG} ${LONG} `)).toEqual([LONG]);
    expect(s.flush()).toEqual([]);
  });

  it("needs whitespace after the terminator, so decimals stay whole", () => {
    const s = new SentenceStream();
    const text =
      "The rate is 3.5 percent and it holds for the whole of the initial term of this agreement unless both parties agree in writing to change it later.";
    expect(s.push(`${text} Next`)).toEqual([text]);
  });

  it("keeps a closing quote with its sentence", () => {
    const s = new SentenceStream();
    const text =
      'The clause records that the answer given at the meeting was "no." and that every party present accepted the outcome without raising any further objection.';
    expect(s.push(`${text} Then he left.`)).toEqual([text]);
  });

  it("cuts at a word boundary when a run has no terminator at all", () => {
    // A long bulleted answer can run for a paragraph without a period;
    // waiting for one would be a long, unexplained silence.
    const long = "word ".repeat(80);
    const out = new SentenceStream().push(long);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.length).toBeLessThanOrEqual(240);
    expect(out[0]!.endsWith("word")).toBe(true);
  });

  it("starts over when the answer is replaced rather than extended", () => {
    // A retry or a server-side history rewrite shortens the text; splicing
    // the new text onto the old offset would speak a fragment of both.
    const s = new SentenceStream();
    s.push("Original first sentence. Original second");
    s.push("Brand new answer. And more");
    expect(s.flush()).toEqual(["Brand new answer. And more"]);
  });

  it("emits nothing twice across a flush", () => {
    const s = new SentenceStream();
    const seen = [...s.push(`${LONG} ${LONG} One. Two.`), ...s.flush()];
    expect(seen).toEqual([LONG, LONG, "One. Two."]);
  });
});

describe("SpeechQueue", () => {
  it("keeps exactly one utterance on the wire", () => {
    const send = vi.fn();
    const q = new SpeechQueue(send);

    q.enqueue("First.");
    q.enqueue("Second.");
    q.enqueue("Third.");

    // The SDK's own response gate collapses everything queued during one
    // response into a single follow-up — so a queue that leaned on it would
    // silently drop the middle of the answer.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith("First.");
    expect(q.pendingCount).toBe(2);

    q.onResponseDone();
    expect(send).toHaveBeenLastCalledWith("Second.");
    q.onResponseDone();
    expect(send).toHaveBeenLastCalledWith("Third.");
    q.onResponseDone();
    expect(send).toHaveBeenCalledTimes(3);
    expect(q.isSpeaking).toBe(false);
  });

  it("ignores blank utterances", () => {
    const send = vi.fn();
    const q = new SpeechQueue(send);
    q.enqueue("   ");
    q.enqueue("\n");
    expect(send).not.toHaveBeenCalled();
  });

  it("clears the speaking flag on cancel, so barge-in cannot wedge it shut", () => {
    const send = vi.fn();
    const q = new SpeechQueue(send);

    q.enqueue("First.");
    q.enqueue("Second.");
    q.cancel();

    expect(q.pendingCount).toBe(0);
    // A cancelled response may never produce the `response.done` that would
    // otherwise release the queue; if cancel left `speaking` set, nothing
    // would ever be spoken again for the rest of the session.
    expect(q.isSpeaking).toBe(false);

    q.enqueue("After barge-in.");
    expect(send).toHaveBeenLastCalledWith("After barge-in.");
  });
});
