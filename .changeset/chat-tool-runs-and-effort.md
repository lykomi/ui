---
"@iloveagents/foundry-web-ui": minor
---

feat(chat): collapse tool runs to a status line, and give every chat surface the same controls

**Tool calls no longer flood the transcript.** A run of adjacent tool calls
folds into one row — "3 tools · done" — with the cards under it, one click from
being folded away. A turn that called eight tools used to render eight bordered
cards with no way to hide them; the run is now a single quiet line you can
collapse when the machinery is in the way.

The cards stay open by default: watching an agent work is the reason to look at
them, and a transcript that hides every step reads as though nothing happened.
The summary says how many calls failed, and turns red only when *every* call
failed — one failure among successes is a run that recovered, not a broken turn.

**One renderer for every chat surface.** The bubble and the expanded chat each
configured `MessagePrimitive.Parts` separately and had drifted — the expanded
chat rendered full tool cards, the bubble rendered assistant-ui's default. Both
now compose `ChatMessageParts`, so there is one place to drift from.

**The bubble composer gets the reasoning-effort picker**, in the same slot the
expanded composer uses — between the input and Send, the placement the rest of
the industry has settled on. It carries the same label, so the two surfaces
read identically.

**New Thread no longer throws you out of the expanded chat.** In expanded mode
the button navigated to `/`, which the shell treats as "collapse expanded
chat" — so it dropped the mode and the page the user was reading. Expanded now
starts the thread in place, the contract the bubble already used.

Rows expose `data-tool-run-group` / `data-tool-run-trigger`, the bubble panel
exposes `data-chat-surface`, and the effort trigger exposes
`data-reasoning-effort-trigger` — stable handles for tests and downstream E2E.
