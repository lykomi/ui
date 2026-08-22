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

| Layer    | Stack                                                                | Versions / pins                              |
| -------- | -------------------------------------------------------------------- | -------------------------------------------- |
| Frontend | TypeScript strict, React 19, Vite, Tailwind v4, shadcn over Radix UI | `@assistant-ui/react` 0.15.x, AG-UI protocol |
| Tooling  | pnpm workspaces, Vitest, Prettier, Changesets                        | Node 22+                                     |

# Grounding (mandatory)

Fast-moving stack. Training data is stale. Before writing code, verify the current API:

| Surface                           | Source of truth                                                                                    | How to query                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| Microsoft Agent Framework         | [microsoft/agent-framework GitHub](https://github.com/microsoft/agent-framework) `python/samples/` | Fetch the closest sample first    |
| `@assistant-ui/react`, `@ag-ui/*` | Official docs, version-pinned                                                                      | Verify against the pinned version |

Rules:

- Do NOT rely on training-data knowledge of `@assistant-ui/*`, `@ag-ui/*`, or Foundry APIs.
- `@assistant-ui/react` is pinned to **0.15.x** in `pnpm-workspace.yaml` — it carries React context plus zustand stores, so a version split silently duplicates them.
- Tool UIs use `makeAssistantToolUI(...)`. The legacy `useAssistantToolUI` hook is gone.
- **`@assistant-ui/store` carries a pnpm patch** (`patches/`) replicating upstream PR #5411 — merged 2026-08-01, still unreleased at 0.3.2. Without it the compiled `NotificationManager` is rebuilt on StrictMode's replay render, every `useAuiState` subscriber binds a dead manager, and **the composer silently ignores all typed input in dev** (production is unaffected — no double-render, which is why this looks like a bundler bug and isn't). Drop the patch once `@assistant-ui/store` > 0.3.2 ships; `packages/web-ui/src/__tests__/composer-input-strictmode.test.tsx` holds the line either way.

# Critical conventions

- **AG-UI adapter — ours, deliberately.** The protocol engine (`AGUIRunner` in `packages/agent/`) drives `HttpAgent.runAgent()` with an `AgentSubscriber` and yields a normalized `RunnerEvent` stream; the assistant-ui shim in `packages/web-ui/` translates those into cumulative `ChatModelRunResult` yields.

  An official `@assistant-ui/react-ag-ui` provider now exists (0.0.x). **We evaluated it in 2026-08 and are NOT adopting it yet** — do not "modernize" onto it without re-checking these blockers:
  - It parses `CUSTOM` and `RAW` AG-UI events and then **drops them** (no callback, no extension point). That silently kills our server heartbeats and citation events — the mechanisms the chat-reliability work is built on.
  - It has no stalled-stream watchdog and no silent-close detection, so a stream that dies mid-answer renders as a clean, truncated completion.
  - Its thread-list and resume surfaces are still `@experimental` / `unstable_`, and the package has no peer range on `@assistant-ui/react` at all.

  Revisit when it exposes a CUSTOM/RAW event hook, leaves 0.0.x, and stabilises resume/threadList. Its interrupt/HITL and A2UI machinery would then be a genuine upgrade over this adapter.

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

# Bot code review (do not skip, do not merge around)

Every PR in this repo is reviewed by **Codex** (`chatgpt-codex-connector`) and
**GitHub Copilot**. Their findings are not advisory noise — in practice they
have caught real defects that green CI and a passing local suite did not: a
frozen column painted over a sticky header, a parser that guessed a date's
country, a documented option that did nothing.

The rule for an agent working here:

1. **Push, then let both bots review.** Codex re-reviews on a new commit and
   on a `@codex review` comment; Copilot's pass is repo automation and cannot
   be requested through the API (`requested_reviewers` silently stays empty) —
   it arrives on its own.
2. **Read every thread, including ones GitHub still shows as "live" from an
   earlier round.** `gh api graphql` → `pullRequest.reviewThreads` with
   `isResolved`/`isOutdated`; a thread whose line still exists stays "live"
   even after the fix, so judge by content, not by the flag.
3. **Fix, push, ask for another pass, and repeat.** Rounds converge — 18
   findings, then 4, then 3 is a normal shape. Do not merge on the first
   green.
4. **Stop when what is left is genuinely minor** — style preference,
   a refactor whose churn outweighs its value, a case the code deliberately
   does not support. Say so in the thread, with the reason, rather than
   leaving it silent. "Fixed" and "declined, because…" are both finished;
   "unread" is not.
5. **Answer in the thread.** A reply is how the next person knows a finding
   was considered rather than missed, and it is what makes round N+1 shorter.

Never merge with unread findings, and never close a thread by force-pushing
over it.
