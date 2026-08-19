---
"@iloveagents/foundry-web-ui": patch
---

Two fixes to the running state of a chat turn.

The activity row said "Thinking…" while the status indicator two lines below
said "Thinking" — the same word twice on one screen, reading as a stutter
rather than as two facts. The row now names its CONTENTS ("Reasoning") and
leaves the run phase to the indicator, which knows things the row cannot:
which tool is in flight, and whether the stream has stalled. Ellipses dropped
with it; the row's spinner already carries "still going".

The message column had `pt-8` and no bottom padding, so whatever came last in
the thread sat flush against the composer. Most visible on the running status
line, which read as part of the input rather than part of the conversation —
but the last message had the same problem, quietly.
