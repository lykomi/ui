---
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-primitives": patch
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-web-shell": patch
"create-foundry-ui-app": patch
---

Docs + packaging polish: restore the `__PROJECT_NAME__` sentinel in the scaffold template README (Prettier had normalized it to `**PROJECT_NAME**`, breaking every generated app's title) and guard it with a test + `.prettierignore`; bump template foundry pins to the current release and enforce parity in `pack:check`; add npm metadata (description, keywords, repository, homepage, bugs) to the four runtime packages; extend the open-core guard to ban `@ltwlf/*` downstream imports; sync web-shell/agent AGENTS.md with the actual public API; add CONTRIBUTING.md + SECURITY.md and README badges/prerequisites.
