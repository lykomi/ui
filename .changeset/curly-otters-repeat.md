---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": minor
---

Bring back `Auto` — this time it says what it resolves to

`Auto` was removed because it was opaque: it claimed the model picked a level per request, while actually sending nothing and letting the backend decide. You could believe you were on Extra High and be running Instant, for a control that determines cost and latency.

It returns with the resolution visible. `reasoningDefaultStore` holds the level the backend applies when no effort is sent; the picker renders it in the trigger (`Auto · Medium`) and the menu (`Currently Medium`). The shell populates it from `GET /api/chat/config`.

Never guesses: if the backend does not report a level — older backend, route absent, request failed, or reasoning switched off — the store stays unset and the picker says "uses the app's configured level" rather than naming one. The store is populated by the host app and never derived client-side, so the label cannot drift from the behaviour it describes.

Explicit levels stay a pin: nothing moves them, including a change of context.
