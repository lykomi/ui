---
"@iloveagents/foundry-web-ui": minor
---

Fold everything an assistant turn did into ONE activity row.

A turn that searched a corpus eleven times rendered eleven "2 tools · done"
rows — one per adjacent run of tool calls — plus a reasoning row of its own,
with the answer somewhere underneath. Each row was individually reasonable;
stacked, they were a ladder the reader had to climb past to reach the point.

The machinery now folds once, at the turn: `Worked · 20 tools · reasoning`.
Inside the fold, order is chronological — reasoning explains the calls that
follow it, so it renders in place, captioned rather than behind a second
disclosure. The answer never goes inside the fold and still comes last.

`ToolRunGroup` (internal, never exported) is superseded by `TurnActivity`.
