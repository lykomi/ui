---
---

Docs: the bot-code-review manual moves to `docs/BOT_CODE_REVIEW.md`, with the
non-negotiables and a link left in AGENTS.md.

Empty on purpose. The rule is that every change carries a changeset; this one
ships nothing to a consumer, so it records the change without asking the
release workflow to publish a version. `changeset status` reports no packages
to bump and `changeset version` consumes the file cleanly.
