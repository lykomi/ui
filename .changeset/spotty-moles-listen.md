---
"@iloveagents/foundry-web-voice": patch
---

Everything the bot-review loop turned up, most of it about a call that outlives
what started it.

**Speech no longer repeats itself.** Two separate paths could re-read text the
user had already heard. `toSpeakableText` kept a half-arrived citation ("[2,")
and stripped the completed one, so the speakable text got SHORTER as the answer
grew; anything voiced across that had to be said again. Normalisation now
strips the unclosed forms too, which makes the closing bracket a no-op. And the
sentence stream no longer re-decides what it has already spoken: the
`MAX_UTTERANCE_CHARS` cut is speculative — it fires only because no sentence
end is in sight — so re-segmenting the whole answer once the period arrives
regrouped that span and re-emitted everything after it. A watermark now makes a
cut permanent the moment it is voiced, as it must be with the audio gone. A
randomised streaming test asserts no utterance is ever spoken twice.

**A dead transport no longer silences every later call.** The speech queue
releases on `response.done`, which a closed socket never sends. `disconnect()`
freed it; an error or a remote close did not — and since the bridge is
installed once for the life of the app, the queue stayed `speaking` and
swallowed every utterance of every subsequent session. One `endCall()` is now
used by all three routes.

**A call that outlives its panel stays usable.** The floating bubble can be
closed while a call continues, so the collapsed launcher shows that it is
running and can end it, the thread surface takes over in the bubble as it does
in the expanded chat, and a spoken turn still reaches the agent — the submit
bridge previously lived inside the open panel and the transcript was dropped.
Audio keeps playing too: sink ownership follows whether an avatar element is
actually mounted rather than whether one was configured.

**The avatar looks like a person again.** The chroma key was tuned by eye to
soften a green fringe and put `similarity + smoothness` at 0.67 — past the
subject, which sits at a UV distance of about 0.53. Every colour came out
semi-transparent (grey 46%, white 43%, skin ~70%): a washed-out ghost. Widening
the band never helped the fringe anyway, since fringe pixels sit below
`similarity` and were already cut. `0.44 / 0.08` removes the fringe more
thoroughly and leaves the subject fully opaque.

Also: cancelling while the transport is still connecting can no longer leave a
live microphone; the end-call control is reachable by keyboard; the visualiser
honours a reduced-motion change made during a call, repaints after a resize,
follows theme layers applied below `<html>`, and no longer forces layout on
every animation frame.
