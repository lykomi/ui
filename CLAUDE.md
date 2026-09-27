@AGENTS.md

## Second review for high-risk PRs (Claude Code)

A PR counts as high-risk when it touches permissions or auth, deletes, prunes
or overwrites data, migrations, the install/apply/publish/sync core, or a
customer deploy path (see `docs/BOT_CODE_REVIEW.md`). Before merging one:

- **Run `/code-review` at high effort** yourself. Handle its findings like a
  Codex round: verify each one, then fix it or answer it.
- **For the riskiest changes, suggest `/code-review ultra` to the user** and
  say why. It is a multi-agent review that runs in the cloud; the user starts
  it and it is billed. You cannot launch it.
- Routine PRs don't need either.
