Foundry UI — open-source agent UI starter for the AG-UI protocol, Microsoft Agent Framework, and Microsoft Foundry. Multi-package monorepo publishing built ESM JavaScript and `.d.ts` declarations.

# Vision & Architecture

```
packages/agent/           → @iloveagents/foundry-agent (cross-runtime transport — AGUIRunner, vanilla zustand stores, MSAL subpath, service-fetch factory)
packages/web-primitives/  → @iloveagents/foundry-web-primitives (leaf primitives — Button, Checkbox, Input, Textarea, Field, FieldSet, cn)
packages/web-ui/          → @iloveagents/foundry-web-ui (React UI core — hooks, registries, assistant-ui adapter shim, ChatPanel, sidebar)
packages/web-shell/       → @iloveagents/foundry-web-shell (browser bootstrap — bootstrapShell + ChatModule protocol)
packages/create-foundry-ui-app/ → create-foundry-ui-app (scaffolding CLI — `npm create foundry-ui-app`)
```

**Tier convention:** `foundry-` prefix on every package projects the brand. `foundry-agent` has no runtime-tier suffix because it's pure cross-runtime transport (zero React, zero DOM). `foundry-web-*` packages are React-DOM tier. Future tiers reserved by convention: `foundry-native-*` (React Native), `foundry-unity-*` (Unity), `foundry-outlook-shell`, `foundry-teams-shell`.

# Stack & Versions

| Layer    | Stack                                                                | Versions / pins                               |
| -------- | -------------------------------------------------------------------- | --------------------------------------------- |
| Frontend | TypeScript strict, React 19, Vite, Tailwind v4, shadcn over Radix UI | `@assistant-ui/react` ≥0.12.x, AG-UI protocol |
| Tooling  | pnpm workspaces, Vitest, Prettier, Changesets                        | Node 22+                                      |

# Grounding (mandatory)

Fast-moving stack. Training data is stale. Before writing code, verify the current API:

| Surface                           | Source of truth                                                                                    | How to query                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| Microsoft Agent Framework         | [microsoft/agent-framework GitHub](https://github.com/microsoft/agent-framework) `python/samples/` | Fetch the closest sample first    |
| `@assistant-ui/react`, `@ag-ui/*` | Official docs, version-pinned                                                                      | Verify against the pinned version |

Rules:

- Do NOT rely on training-data knowledge of `@assistant-ui/*`, `@ag-ui/*`, or Foundry APIs.
- `@assistant-ui/react` must stay on **0.12.x or newer** (0.11.x has a `_getInitializePromise` runtime regression).
- Tool UIs use `makeAssistantToolUI(...)` (the v0.12 canonical pattern).

# Critical conventions

- **AG-UI adapter** — there is no official `@assistant-ui/ag-ui` adapter. The protocol engine (`AGUIRunner` in `packages/agent/`) drives `HttpAgent.runAgent()` with an `AgentSubscriber` and yields a normalized `RunnerEvent` stream. The assistant-ui shim in `packages/web-ui/` translates those into cumulative `ChatModelRunResult` yields.
- **Cross-runtime contract** — `@iloveagents/foundry-agent` has zero React, zero `@assistant-ui/*`, zero DOM. Enforced by `packages/web-ui/src/__tests__/open-core-guards.test.ts`. Future Outlook / Teams / native shells consume it directly.
- **Zustand pattern** — `@iloveagents/foundry-agent` uses `zustand/vanilla`; React consumers bind via `useStore(store, selector)` from `"zustand"`.
- **Built packages** — runtime packages publish `dist/` ESM JavaScript and `.d.ts` declarations. Keep package exports pointed at `dist`, and keep CI package checks green before merging.

# Boundaries

**Always do:**

- Run `pnpm test` before committing (lint + typecheck + unit).
- Run `pnpm typecheck` after TypeScript changes.

**Never do:**

- Use `@/` path aliases in packages (relative imports only).
- Add backward-compatibility shims pre-1.0 — every caller updates lock-step in the same PR.
- Import `react`, `react-dom`, `@assistant-ui/*`, or bare `"zustand"` inside `packages/agent/src/` (msal subpath excepted for `@azure/msal-browser`).
- **Re-introduce sibling `@iloveagents/foundry-*` packages into `peerDependencies`.** They belong in `dependencies` with `workspace:*` — the four ship together as a coordinated `fixed` changesets group, and pnpm hoists by name so consumers still get a single instance. As peerDeps they trigger changesets' `shouldBumpMajor` cascade: one `minor` on any sibling exits the strict `^0.x.y` peer range, promotes every dependent to a major bump, and the `fixed` group then syncs all four to it. This has fired once — `1.0.0` and `1.0.1` exist on npm as a result and can never be reused, which is why the version line skips them. Enforced by [`open-core-guards.test.ts`](packages/web-ui/src/__tests__/open-core-guards.test.ts).
- **Name a private deployment** — an organisation, tenant, or internal project — anywhere in this repo, including code comments, changesets, generated changelogs, docs, and **commit messages**. Enforced by `pnpm check:sensitive` (in `pnpm test` and CI). Phrase it generically instead: "a downstream app", "a production deployment". Commit messages are checked too, because anything reachable from a pull-request ref is retained by the forge indefinitely — a later branch rewrite does not undo it.

# Code Style

- TypeScript strict; relative imports only.
- React: one component per file, split at ~200 lines, extract shared logic into custom hooks.
- Tailwind v4: utility classes, `cn()` for conditional classes, design tokens not magic values.
- Prefer editing existing files over creating new ones.
- Verify Microsoft Agent Framework / assistant-ui APIs against latest docs before writing code (see Grounding).

# Commands

```bash
pnpm install
pnpm test           # build + lint + typecheck + unit (pre-commit suite)
pnpm test:unit      # vitest run across packages
pnpm typecheck      # tsc --noEmit across packages
pnpm changeset      # add a versioning changeset before committing
```

# Open-core packaging (history)

Foundry UI was extracted from a commercial product on 2026-04-26. The four packages here were renamed — useful if you are migrating off the old scope:

| Origin                      | Now                                   |
| --------------------------- | ------------------------------------- |
| `@lastspace/agent`          | `@iloveagents/foundry-agent`          |
| `@lastspace/web-primitives` | `@iloveagents/foundry-web-primitives` |
| `@lastspace/web-ui`         | `@iloveagents/foundry-web-ui`         |
| `@lastspace/web-shell`      | `@iloveagents/foundry-web-shell`      |

# Where to find more

- Per-package architecture → each package's own `AGENTS.md`
- AG-UI runner contract → [`packages/agent/AGENTS.md`](packages/agent/AGENTS.md)
- Browser bootstrap + ChatModule protocol → [`packages/web-shell/AGENTS.md`](packages/web-shell/AGENTS.md)
- Open-core import-direction graph + guard tests → [`packages/web-ui/src/__tests__/open-core-guards.test.ts`](packages/web-ui/src/__tests__/open-core-guards.test.ts)
- AG-UI protocol → https://github.com/ag-ui-protocol/ag-ui
- Microsoft Agent Framework → https://github.com/microsoft/agent-framework

# Notes for other agents

- **Codex**: reads this file natively. Layering: nearest `AGENTS.md` wins for a given path.
- **Claude Code**: reads `CLAUDE.md` which `@`-imports this file, plus per-package `CLAUDE.md` files. Repo-local config: `.claude/settings.json` (permissions) + `.mcp.json` (grounding MCPs).
- **GitHub Copilot / Cursor**: both read root + nested `AGENTS.md` natively; Copilot coding agent preinstalls deps via `.github/workflows/copilot-setup-steps.yml`.
- **Downstream apps** (generated starters, products built on these packages): install the Claude Code plugin — `/plugin marketplace add iLoveAgents/foundry-ui` → `/plugin install foundry-ui@foundry-ui`. Source: [`plugins/foundry-ui/`](plugins/foundry-ui/) (grounding skill, ChatModule authoring skill, doc MCPs). Keep the plugin's skills in sync with this file's Grounding + conventions sections when they change.
