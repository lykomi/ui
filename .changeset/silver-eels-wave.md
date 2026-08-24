---
"@iloveagents/foundry-web-voice": patch
---

Six from the final review round, two of them things the user would have heard.

**An answer ending in bracketed prose lost it.** "…and then choose [yes/no]"
was spoken without the options. Holding a trailing bracket back is right while
streaming — one more character could make it a link — but once the answer has
settled nothing more can arrive, so holding it no longer defers the words, it
deletes them. Settled text keeps them (and drops the brackets, which a voice
would otherwise read aloud).

**A typed draft was destroyed by a spoken turn.** The composer stays editable
during a call, so the transcript overwrote whatever was in it and sent that
too, attachment included. The draft is restored afterwards.

Also: a host unmounting while the transport was still connecting could still
produce a live session with nothing to control it (`connected` is false both
before a call and during setup, so the earlier guard could not tell them
apart); the thread surface was cleared without checking it was still ours; and
`VoiceStage` treated an explicit `null` stream override as an omission and
handed back the live stream.
