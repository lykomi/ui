---
"@iloveagents/foundry-web-ui": minor
---

feat(chat): collapse tool runs to a status line, and give every chat surface the same controls

**Tool calls no longer flood the transcript.** A run of adjacent tool calls
collapses to one row — "3 tools · done" — with the cards one click behind it.
A turn that called eight tools used to render eight bordered cards and push the
answer off screen; the answer now sits directly under a single quiet line. Runs
containing a failure open themselves and say how many failed, because a red
summary the reader has to click to understand is worse than no summary.

**One renderer for every chat surface.** The bubble and the expanded chat each
configured `MessagePrimitive.Parts` separately and had drifted — the expanded
chat rendered full tool cards, the bubble rendered assistant-ui's default. Both
now compose `ChatMessageParts`, so there is one place to drift from.

**The bubble composer gets the reasoning-effort picker**, icon-only so it fits
a 380px panel without crowding the input. The full label is still its
accessible name.

**New Thread no longer throws you out of the expanded chat.** In expanded mode
the button navigated to `/`, which the shell treats as "collapse expanded
chat" — so it dropped the mode and the page the user was reading. Expanded now
starts the thread in place, the contract the bubble already used.

Rows expose `data-tool-run-group` / `data-tool-run-trigger`, the bubble panel
exposes `data-chat-surface`, and the effort trigger exposes
`data-reasoning-effort-trigger` — stable handles for tests and downstream E2E.
