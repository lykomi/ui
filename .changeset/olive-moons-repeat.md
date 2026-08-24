---
"@iloveagents/foundry-web-voice": patch
---

Two bugs a live session found, both in relay mode's speech path.

Speech could be queued before the transport was up: `helpers` exists from the
first line of the adapter's `setup`, well before `connect()` resolves, so an
answer arriving in that window was sent into a socket that was not open yet.
The utterance was lost, and because the queue then believed it was speaking,
the `response.done` that would release it never came — the session went silent
for the rest of its life. Liveness now means connected.

Connecting voice also read the last answer on screen back to the user. The
relay watcher is mounted for the whole app lifetime and sees a completed
answer the moment a session goes live; it now marks whatever is already there
as delivered, so voice starts by listening rather than reciting.
