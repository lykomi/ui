# @iloveagents/foundry-web-primitives

## 0.2.0

### Minor Changes

- b0980d2: Initial public release at 0.1.0.

  Extracted from `ltwlf/lastspace` (with full git history) and renamed under the
  `@iloveagents/foundry-*` umbrella:
  - `@iloveagents/foundry-agent` — cross-runtime AG-UI transport (zero React, zero DOM)
  - `@iloveagents/foundry-web-primitives` — leaf React-DOM primitives
  - `@iloveagents/foundry-web-ui` — React UI core (hooks, registries, assistant-ui adapter, ChatPanel)
  - `@iloveagents/foundry-web-shell` — browser bootstrap (`bootstrapShell({ modules, pages, theme })`)

  Pre-1.0 alpha rule: API surface iterates lock-step. SemVer enforced post-1.0.
