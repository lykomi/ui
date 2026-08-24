---
"@iloveagents/foundry-web-ui": patch
---

Make the floating chat bubble a full peer of the expanded chat.

`ChatBubble` renders a registered `threadSurface`, which only `ChatContent` did
before. Since the bubble also carries the composer action slots, a module could
be STARTED there and then ran with the ordinary transcript on screen — while
the module, seeing its surface registered, correctly stood its own UI down.
`composer-surface-parity.test.ts` now guards the general shape, because a
capability added to one composer and forgotten in the other is the recurring
failure rather than this one instance of it.

`ComposerSubmitBridge` is also mounted for the whole life of the bubble instead
of only while the panel is open. A module can keep working after the panel
closes — a voice call does exactly that — and its submitted text was landing in
the pending store with nothing left mounted to send it, each new submission
overwriting the last. Because that makes several bridges legitimately mountable
at once, the store now hands out an atomic claim so exactly one sends, which
also closes a StrictMode double-send.
