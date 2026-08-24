---
"@iloveagents/foundry-web-ui": minor
---

Rework the composer: one row, one "+", and a corner that Send can hand over.

The leading controls were a row of single-purpose icons that grew every time
the product learned a trick, and each one cost the user a guess. They are now
one `ComposerAddMenu` — a labelled menu holding Attach file and Pin this page.
Pinning in particular is a power feature that did not deserve permanent
residency next to the text field; `ContextPins` still shows what _is_ pinned.

The composer is a single row when it has the width for one and two rows when
it does not, decided by wrapping rather than a breakpoint: the input keeps
`w-full` while narrow, which pushes it onto its own line and leaves `+` and
the trailing controls below it. The old always-two-rows layout existed to stop
controls floating mid-height beside tall wrapped text — that only ever happened
narrow, which still gets two rows.

`registerChatSlots({ composerActionsReplaceSend: true })` lets a module's
`composerActions` stand in for Send while the composer is empty, so a voice
button can hold the corner until there is something to send. Opt-in: a slot
holding something unrelated must not make Send disappear. Exposed as
`useComposerActionsOwnSend()`.

Placeholder default is now `DEFAULT_COMPOSER_PLACEHOLDER` ("Ask anything") and
overridable via `<ChatContent placeholder>`. "Message Assistant..." named the
machine and told the user nothing.

Also exports `usePagePin()`, so the pin badge and the add-menu cannot drift
apart on what "pinned" means.
