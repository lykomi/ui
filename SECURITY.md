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

Dependabot checks the npm workspace, GitHub Actions and Python starter/preset manifests weekly. Normal version updates wait at least seven days after release; security updates are independent of this cooldown. AG-UI, coordinated assistant-ui/Agent Framework and authentication updates appear as separate proposals requiring compatibility review. Major proposals stay visible and require human approval.

Review update diffs and advisories, run the repository checks and starter package smoke tests when affected, and obtain final-head review before merging. Preserve coordinated framework versions, the assistant-ui store patch, and single React/router instances. A merge does not publish packages: use the existing Changesets and Release npm workflow, then update and verify downstream consumers against the published artifacts. Never publish manually or automatically merge solely because an update is a patch/minor release.

## Reviewed automatic updates

The `Reviewed dependency updates` workflow evaluates same-repository Dependabot
PRs without checking out or executing their code. Automatic writes require the
repository variable `DEPENDENCY_AUTOMERGE_ENABLED=true`. Normal stable patch/minor
updates may merge only after final-head Codex review, resolved findings, successful
trusted CI, and strict protection requiring Quality, Runtime skills and Neo4j
preset on current main. Signed Dependabot metadata must classify every dependency;
unknown, mixed-major, pre-1.0 minor, controlled-framework and authentication
updates remain for review. Only manifest/lockfile changes qualify; Docker and
GitHub Actions proposals still require explicit review. At most one PR merges per
run, with the exact SHA rechecked immediately before merging.

Run `python3 scripts/dependency_automation.py --repo lykomi/ui` for a read-only
report. Enable writes only after verifying the full eligibility path and the
active branch rules. The workflow uses a repository token: its merges do not
trigger ordinary push workflows, so release through the existing explicit
Release npm/Changesets procedure. Source merging is not package publication.

## Major upgrade preparation

Assign one upgrade family to the `dependency-upgrades` Copilot custom agent in
`.github/agents/dependency-upgrades.agent.md`. It reads upstream migration guides,
adapts callers and tests, checks packed artifacts and starter behavior, and opens
a draft PR. Its report evaluates useful new capabilities against a concrete use
case, compatibility and cost; unrelated feature development stays separate.
Codex reviews the finished implementation; a human approves the major merge.
The agent may not release, merge, weaken protection or request registry secrets.

GitHub native scheduled automations currently support private/internal repositories
only. This public repository uses explicit bounded Copilot tasks for major upgrades.
A custom-agent file configures behavior; it does not prove scheduled tasks are running. Verify the provider's existing entitlement and a hard spending limit
before enabling recurring paid runs. A prompt or task-count limit is not a monetary
cap. Do not add a publishing token or broad personal token to Actions merely to
start agent sessions. GitHub's agent-task API requires user authentication.
