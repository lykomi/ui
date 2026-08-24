---
"@iloveagents/foundry-web-ui": minor
---

New `threadSurface` chat slot: a module can render _instead of_ the message
viewport, for a mode that replaces the conversation rather than adding to it.
A live voice call is the case it exists for — while you are talking, the
transcript scrolling past is not what you are looking at, and "How can I help
you today?" is the wrong question once the answer is "say it out loud".

Unlike the other slots it is set and cleared at runtime: registering the
component IS the takeover, clearing it hands the thread back, so there is no
second "is it active" flag to keep in step. The thread is hidden rather than
unmounted, so its scroll position and any in-flight run survive the round trip.
