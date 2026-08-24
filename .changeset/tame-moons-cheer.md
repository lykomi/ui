---
"@iloveagents/foundry-web-voice": patch
---

Fix a tool-catalogue update that could be dropped for the life of a session
(found in review).

Page tools are registered and cleared on navigation, so the catalogue can
change between mount and `session.created`. The subscriber returned early
while the session was not ready — and nothing replayed it once it was, so a
navigation during connect left the model unable to act on the page the user
was looking at, or calling a tool that no longer existed, until the next
registry change happened to arrive.

The sync now runs on the ready edge as well as on registry changes. Making
that safe needed the second half: `clientToolRegistry` is a zustand store, so
subscribers fire on _any_ write, and re-syncing on every one would put a
`session.update` on a live socket for changes that are not tool changes.
`ToolSync` compares the serialized catalogue and stays quiet when it matches —
which also makes the extra ready-edge call free.

Also: the visualiser re-reads its theme tokens periodically while animating.
Watching the root element for class / `data-theme` changes catches a light-dark
toggle, but foundry applies theme _layers_ as inline style on a `ThemeScope`
element — invisible from the root — so a custom theme swap mid-call left the
canvas painted in the old palette.
