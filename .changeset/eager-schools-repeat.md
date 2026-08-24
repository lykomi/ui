---
"@iloveagents/foundry-web-voice": patch
---

Six edge cases from the last review round, mostly about who owns what when a
call ends or changes hands.

A response cancelled by barge-in still reports `response.done`, usually after
the next answer has begun — released then, it freed an utterance while one was
still being spoken and the two ran together. Completions are matched to the
response they belong to by id.

A host removed mid-call (a conditional `<FoundryVoice/>`, a module torn down)
left assistant-ui holding a running voice session and the speech queue wedged
for whatever mounted next; losing the host now ends the call. A fatal error
published together with the disconnect was reported as a clean hang-up, because
the disconnect effect runs first and `end()` is once-only. And the bare audio
sink no longer briefly co-owns the stream with an avatar panel that is mounting
in the same commit.

Normalisation covers one more construct: a markdown link whose target is still
arriving. The bracket is already closed so the unclosed-bracket rule does not
apply, and `LINK` needs the `)` before it can reduce to the label, so the raw
URL entered the speakable text and then vanished — a shrink, and a shrink after
the span has been voiced is a re-read.
