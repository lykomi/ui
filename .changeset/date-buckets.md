---
"@iloveagents/foundry-web-ui": minor
---

Dates become things you can tick. `ageBucket` ("today", "last 7 days", …), `dueState` ("overdue", "soon", "later", "undated") and `relativeAge` ("6 d ago") turn a timestamp into the words a person filters by — feed them to `meta.facetBuckets` and counts, OR-within, AND-across, the URL and the agent tools work on them unchanged. `parseDateish` reads only shapes whose meaning is not in doubt — ISO (with an optional time and zone), the dotted European `d.m.yyyy`, and year-first `yyyy/m/d` — and validates the calendar day. Everything else is `null`, including `03/04/2026` and `03-04-2026` (March in one country, April in another) and the shorthand a lenient parser invents dates from (`Date.parse("1")` is the year 2001). A field where people write "Contract signature (May)" needs a parser that says no.
