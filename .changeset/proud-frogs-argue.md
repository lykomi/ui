---
"@iloveagents/foundry-web-voice": patch
---

A quality pass with two real bugs in it, both found by re-reading, both now
impossible to reintroduce silently.

**The microphone can no longer end up hot behind a UI that says muted.**
Half-duplex used to release its auto-mute whenever the assistant stopped
speaking — including when the _user_ had asked for mute in the meantime, in
which case the release reopened a microphone the button said was closed. The
decision now lives in `HalfDuplexGate`, a pure machine that releases only what
it took (the user's intent is recorded on the bridge, where the runtime's mute
controls land) and engages only on the transition into speaking, so an
explicit mid-answer unmute stands — barge-in is a decision, not a glitch.

**`<FoundryVoice/>` no longer installs during render.** `installVoice` writes
to zustand stores, and doing that in a `useState` initializer meant
StrictMode's double invocation built two bridges and left the discarded one's
adapter registered while the mounted host owned the other — the first connect
then waited on a bridge nobody attached to until the 10s timeout. Installation
is an effect now, with a StrictMode test that reads the store during render
and asserts it is untouched.

Also in this pass: a finished session resets the stage's state, so the next
call cannot open on the previous call's caption and a dead analyser; the
visualiser observes theme changes itself (root-element attributes and the OS
scheme) instead of relying on a prop, so it recolours when "system" flips;
and the avatar's chroma key is tunable via `chromaKey`, with a softer default
edge than the SDK's, which left a green fringe on the silhouette in live runs.
