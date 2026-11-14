# Contributing to LYKOMI UI

Thanks for contributing! This is a pnpm monorepo publishing four runtime
packages plus a scaffolding CLI. The short version:

## Setup

```bash
pnpm install        # Node 22+, pnpm via corepack
pnpm test           # build + lint + typecheck + unit tests — must pass before every commit
```

## Making a change

1. Branch from `main`; one coherent concern per PR.
2. Follow the conventions in [`AGENTS.md`](AGENTS.md) (they bind humans too):
   TypeScript strict, relative imports inside packages, no
   backward-compatibility shims pre-1.0 — update every caller in the same PR.
3. Verify fast-moving third-party APIs (`@assistant-ui/*`, `@ag-ui/*`,
   Microsoft Agent Framework) against their current docs, not memory — see the
   Grounding section of `AGENTS.md`.
4. Add or update unit tests. The open-core guard tests
   (`packages/web-ui/src/__tests__/open-core-guards.test.ts`) enforce the
   import-direction graph — don't work around them.
5. **Add a changeset**: `pnpm changeset`. Every user-visible change needs one;
   the four runtime packages version together as a fixed group.

## Releases

Merged changesets accumulate on `main`; the release workflow
(`.github/workflows/release-npm.yml`) opens a version PR and publishes to npm
when it merges. Never list sibling `@lykomi/*` packages in
`peerDependencies` — see the "Never do" section of `AGENTS.md` for why.

## Checks that must be green

- `pnpm test` — build, Prettier, typecheck, Vitest
- `pnpm pack:check` — tarball contents + template version parity
- CI also runs `pnpm smoke:starter:browser` (scaffold + Playwright smoke)

## Reporting issues

Use [GitHub issues](https://github.com/lykomi/ui/issues). For
security reports, see [`SECURITY.md`](SECURITY.md) — please don't open public
issues for vulnerabilities.
