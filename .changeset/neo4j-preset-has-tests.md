---
"create-foundry-ui-app": minor
---

The neo4j starter ships a test suite, and CI runs it against a real database

The preset's agent had no automated coverage at all: every claim about it was
verified by hand, once, and nothing re-checked it on the next change. It now
ships `agent/tests/` and a `pnpm test:agent` script.

The suite is in two halves. The pure tests need nothing — the JSON coercion
that narrows integers JavaScript would silently round and floats it cannot
parse at all, the connected-core capping that keeps a capped graph from
becoming confetti, the per-hit budget that both the node and edge caps spend
through, and the write-keyword scan that must not be fooled by a string, a
comment or a backtick-quoted label. The live tests need a database and SKIP
without one, so a fresh clone runs green and meaningful before anything has
been started.

Two things are only testable live, and they are the two worth the service
container: that a `READ`-mode session is refused a write BY THE SERVER rather
than by the regex in front of it, and what the driver actually hydrates for the
endpoints of a bare relationship — a fixture would get that wrong in exactly
the direction that hides the bug.
