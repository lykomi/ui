---
"@iloveagents/foundry-web-voice": patch
---

Stop both ways a voice session could talk to itself, and stop server tools
evicting the browser's.

A finished answer was spoken on a loop. The relay watcher re-reports an answer
that is already complete — the thread's message array gets a new identity on
any notification, not only on new text — and clearing the tracked id on
completion made each of those look like a brand-new answer, reset the sentence
stream and speak the whole reply again, forever. Answers now carry a "spoken to
the end" marker, and barge-in retires the interrupted answer rather than
forgetting which one it was.

In `realtime`, the assistant on laptop speakers hears itself: its own voice
trips the service's VAD, which commits a turn, which produces another reply.
New `halfDuplex` option holds the microphone closed while the assistant speaks.
Off by default, because it costs barge-in — worth it on speakers, wrong with a
headset. A VAD misfire's empty transcript no longer becomes a blank user turn
either.

Host-declared tools now MERGE with the client tool registry instead of
replacing it. Declaring an MCP server or a Foundry agent tool adds server-side
capability; a plain spread silently dropped every `ui_*` and `page_*` tool the
moment one was declared, leaving the model unable to touch the UI with nothing
to explain why. Function tools merge by name, so a deliberate override still
works.

Utterances are also coalesced to ~140 characters before being spoken. Each one
is a separate synthesis and every boundary is an audible seam; speaking each
short sentence the instant it landed turned one answer into four of them.
