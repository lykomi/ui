---
---

Docs: the bot-review loop now says how hard to try. Fix what would plausibly
happen, decline what is merely possible with an answer in the thread — and
make the exception for outcomes nobody can undo, judged by what a mistake
costs rather than by which verb the code uses.

Empty on purpose. The rule is that every change carries a changeset; this one
ships nothing to a consumer, so it records the change without asking the
release workflow to publish a version. `changeset status` reports no packages
to bump and `changeset version` consumes the file cleanly.
