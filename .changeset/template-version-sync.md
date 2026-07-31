---
"create-foundry-ui-app": patch
---

Scaffold the current package line: template pins move to the versions the workspace publishes, and `pnpm changeset:version` now syncs them automatically (`scripts/sync-template-versions.mjs`). The template isn't a workspace member, so Changesets can't bump it — previously it silently fell a release behind and new apps scaffolded stale packages.
