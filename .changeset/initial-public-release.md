---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-primitives": minor
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": minor
---

Initial public release at 0.1.0.

Extracted from `ltwlf/lastspace` (with full git history) and renamed under the
`@iloveagents/foundry-*` umbrella:

- `@iloveagents/foundry-agent` — cross-runtime AG-UI transport (zero React, zero DOM)
- `@iloveagents/foundry-web-primitives` — leaf React-DOM primitives
- `@iloveagents/foundry-web-ui` — React UI core (hooks, registries, assistant-ui adapter, ChatPanel)
- `@iloveagents/foundry-web-shell` — browser bootstrap (`bootstrapShell({ modules, pages, theme })`)

Pre-1.0 alpha rule: API surface iterates lock-step. SemVer enforced post-1.0.
