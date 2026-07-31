# Changesets

Per-package versioning + changelogs for `@iloveagents/foundry-*`.

## Adding a changeset

```bash
pnpm changeset
```

Pick affected packages, choose major/minor/patch, write the user-facing summary. Commit the generated `.md` alongside your code.

## Releasing

`release-npm.yml` runs on push to `main`:

1. If pending changesets exist, opens a "chore: version packages" PR that bumps versions + writes CHANGELOG entries.
2. When that PR merges, the workflow re-runs and (once Trusted Publishing is wired up) publishes via `pnpm changeset:publish`.

Pre-1.0 alpha rule: breaking changes can land in minor bumps; lock-step updates expected. SemVer is enforced from 1.0 onward.

See the official docs: https://github.com/changesets/changesets
