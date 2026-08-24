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
  it("emits each sentence once as cumulative text grows", () => {
    const s = new SentenceStream();
    expect(s.push("Hello there.")).toEqual([]);
    expect(s.push("Hello there. How are")).toEqual(["Hello there."]);
    expect(s.push("Hello there. How are you? I am")).toEqual(["How are you?"]);
    expect(s.flush()).toEqual(["I am"]);
  });

  it("needs whitespace after the terminator, so decimals stay whole", () => {
    const s = new SentenceStream();
    expect(s.push("The rate is 3.5 percent and holds. Next")).toEqual([
      "The rate is 3.5 percent and holds.",
    ]);
  });

  it("keeps a closing quote with its sentence", () => {
    const s = new SentenceStream();
    expect(s.push('He said "no." Then he left.')).toEqual(['He said "no."']);
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
    const out = s.push("Brand new answer. And more");
    expect(out).toEqual(["Brand new answer."]);
  });

  it("emits nothing twice across a flush", () => {
    const s = new SentenceStream();
    const seen = [...s.push("One. Two."), ...s.flush()];
    expect(seen).toEqual(["One.", "Two."]);
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
