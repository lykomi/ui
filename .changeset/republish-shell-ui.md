---
"@iloveagents/foundry-web-shell": patch
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-primitives": patch
---

chore(release): republish web-shell + web-ui (npm refused 1.0.0 — version was previously reserved)

No source changes. The 1.0.0 release ran successfully for
`@iloveagents/foundry-agent` and `@iloveagents/foundry-web-primitives`,
but the npm publish for `@iloveagents/foundry-web-shell@1.0.0` and
`@iloveagents/foundry-web-ui@1.0.0` failed with E400 "Cannot publish
over previously published version" — those exact version numbers
appear to have been reserved on the registry from an earlier
publish-then-unpublish cycle. Bumping the fixed group to 1.0.1 so
the four packages stay version-aligned and the publish goes through.
