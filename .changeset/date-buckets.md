---
"@iloveagents/foundry-web-ui": minor
---

Dates become things you can tick. `ageBucket` ("today", "last 7 days", …), `dueState` ("overdue", "soon", "later", "undated") and `relativeAge` ("6 d ago") turn a timestamp into the words a person filters by — feed them to `meta.facetBuckets` and counts, OR-within, AND-across, the URL and the agent tools work on them unchanged. `parseDateish` reads ISO and the dotted European form but refuses `03/04/2026`, which is March in one country and April in another; a filter that guesses is worse than one that says it cannot tell.
