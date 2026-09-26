---
"@iloveagents/foundry-agent": patch
---

A tool call the server answered is never replayed as a client continuation.

A host can register a UI tool locally (open a panel, highlight a row) and still let the server answer it: the runner applies the effect at `tool-call-end`, and when a `TOOL_CALL_RESULT` for the same call arrives it no longer re-issues the run with the local result. This lets a server keep purely cosmetic UI tools off the browser's critical path. A background tab the browser has frozen cannot post a continuation, so a turn waiting on one would wait until somebody looked at the tab again.
