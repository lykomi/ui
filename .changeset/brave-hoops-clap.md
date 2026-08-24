---
"create-foundry-ui-app": patch
---

Re-release so the scaffold pins a voice version that exists.

`0.6.0` shipped a template pinning `@iloveagents/foundry-web-voice@0.1.0`,
which was published broken and superseded by `0.1.1`. The pin is exact by
design — a range would let new projects scaffold a release behind — so a new
version of a pinned package means the CLI has to be released again to carry it.
Publishing the fixed package alone leaves every `npx create-foundry-ui-app`
pointing at the broken one.
