# Security Policy

## Supported versions

LYKOMI UI is pre-1.0; only the latest published `0.x` release line receives
security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/lykomi/ui/security/advisories/new)
— do **not** open a public issue.

We aim to acknowledge reports within 3 business days. Please include a
reproduction, the affected package(s) (`@lykomi/*` or
`create-lykomi-app`), and the version.

## Dependency maintenance

Dependabot checks the npm workspace, GitHub Actions and Python starter/preset manifests weekly. Normal version updates wait at least seven days after release; security updates are independent of this cooldown. AG-UI and coordinated assistant-ui/Agent Framework changes require manual compatibility review; ignored updates still require security-alert triage.

Review update diffs and advisories, run the repository checks and starter package smoke tests when affected, and obtain final-head review before merging. Preserve coordinated framework versions, the assistant-ui store patch, and single React/router instances. A merge does not publish packages: use the existing Changesets and Release npm workflow, then update and verify downstream consumers against the published artifacts. Never publish manually or automatically merge solely because an update is a patch/minor release.
