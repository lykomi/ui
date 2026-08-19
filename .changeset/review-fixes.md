---
"@iloveagents/foundry-web-ui": patch
---

Four fixes from review of the turn-activity work.

Markdown parts get a wrapper element again. `MarkdownText` renders
`<ReactMarkdown>` directly, which emits its top-level blocks into a fragment —
without an element to hold them, every paragraph and list became a direct
child of the message's `gap-4` flex container and picked up 16px of
message-part spacing on top of its own margins.

The activity row's summary is now its accessible name. An `aria-label`
replaces the name a button derives from its contents, so a generic one
announced the row while hiding the call count, the failure count, and whether
there was reasoning to read.

The all-failed alarm waits for the turn to settle. A run whose only calls so
far had failed went red mid-turn, while the model was still working toward one
that succeeds.

The effort gauge only replaces the words when it has a level to show. With no
resolved level a narrow composer showed four faint bars and a caret, with the
explaining tooltip out of reach on touch.
