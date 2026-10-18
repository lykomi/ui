Foundry UI — open-source agent UI starter for the AG-UI protocol, Microsoft Agent Framework, and Microsoft Foundry. Multi-package monorepo publishing built ESM JavaScript and `.d.ts` declarations.

# Vision & Architecture

```
packages/agent/           → @iloveagents/foundry-agent (cross-runtime transport — AGUIRunner, vanilla zustand stores, MSAL subpath, service-fetch factory)
packages/web-primitives/  → @iloveagents/foundry-web-primitives (leaf primitives — Button, Checkbox, Input, Textarea, Field, FieldSet, cn)
packages/web-ui/          → @iloveagents/foundry-web-ui (React UI core — hooks, registries, assistant-ui adapter shim, ChatPanel, sidebar)
packages/web-shell/       → @iloveagents/foundry-web-shell (browser bootstrap — bootstrapShell + ChatModule protocol)
packages/web-voice/       → @iloveagents/foundry-web-voice (OPTIONAL spoken conversation — Azure Voice Live as an assistant-ui RealtimeVoiceAdapter)
packages/create-foundry-ui-app/ → create-lykomi-app (scaffolding CLI — `npm create lykomi-app`)
```

**`web-voice` is optional and versions on its own.** Nothing in this repo imports it, and it is
deliberately outside the `fixed` changesets group — a voice release must not bump the coordinated
four.

Optional here means _at runtime, not at scaffold time_. The template does depend on it and does
import `createVoiceModule`, but only calls it when `VITE_VOICE_PROXY_URL` is set; with the variable
unset the call is unreachable and the bundler drops the package entirely (asserted by
`smoke:starter` — a default scaffold's build contains no Voice Live code). An app that never sets
it therefore has an unchanged composer, an unchanged runtime, and no added bytes.

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
- **Publish by hand with `npm publish`.** The sibling `@iloveagents/foundry-*` deps carry
  `workspace:^`, and only pnpm rewrites that into a real range when packing — `npm publish` uploads
  the protocol string verbatim, and every install of the result fails with
  `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. It also skips `pack:check`, which already refuses workspace
  ranges in a packed tarball. Releases go through the Release npm workflow; a version published
  around it cannot be taken back, only superseded. This has fired once, on
  `@iloveagents/foundry-web-voice@0.1.0`.

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
pnpm smoke:starter  # scaffold the default preset from local packs and build it
pnpm smoke:neo4j    # same for the neo4j preset, plus its bundle assertions
pnpm changeset      # add a versioning changeset before committing
```

The starter smokes install a generated app from freshly PACKED tarballs, never
from npm — a scaffold pins published versions, so a smoke that installed those
would test the last release rather than the change in hand. The neo4j one also
carries the assertions for things that break silently and still build: the
`vendor-graph` chunk order, the Tailwind `@source` the graph chrome needs, and
whether the module registered its tools at all.

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
- Voice (modes, proxy, the assistant-ui voice contract) → [`docs/VOICE.md`](docs/VOICE.md)
- Browser bootstrap + ChatModule protocol → [`packages/web-shell/AGENTS.md`](packages/web-shell/AGENTS.md)
- Open-core import-direction graph + guard tests → [`packages/web-ui/src/__tests__/open-core-guards.test.ts`](packages/web-ui/src/__tests__/open-core-guards.test.ts)
- AG-UI protocol → https://github.com/ag-ui-protocol/ag-ui
- Microsoft Agent Framework → https://github.com/microsoft/agent-framework

# Notes for other agents

- **Codex**: reads this file natively. Layering: nearest `AGENTS.md` wins for a given path.
- **Claude Code**: reads `CLAUDE.md` which `@`-imports this file, plus per-package `CLAUDE.md` files. Repo-local config: `.claude/settings.json` (permissions) + `.mcp.json` (grounding MCPs).
- **GitHub Copilot / Cursor**: both read root + nested `AGENTS.md` natively; Copilot coding agent preinstalls deps via `.github/workflows/copilot-setup-steps.yml`.
- **Downstream apps** (generated starters, products built on these packages): install the Claude Code plugin — `/plugin marketplace add lykomi/ui` → `/plugin install foundry-ui@foundry-ui`. Source: [`plugins/foundry-ui/`](plugins/foundry-ui/) (grounding skill, ChatModule authoring skill, doc MCPs). Keep the plugin's skills in sync with this file's Grounding + conventions sections when they change.

# What ships is the published package, not the workspace

Consumers install `@iloveagents/foundry-*` from npm. A sibling workspace
(`lastspace-meta`) links this source directly, which is convenient and
misleading: an export that exists only here looks fine to a linked consumer
and is missing for everyone else until it is released.

- **A new export is not usable by a consumer until it is published.** If a
  downstream repo needs it, the order is: merge here → merge the changesets
  version PR → confirm npm has it → bump the consumer's pin.
- **Check the artifact, not the build.** `npm pack @iloveagents/foundry-web-ui@<v>`
  and look inside: the symbol, and `dist/styles.css` if the change ships CSS.
  A green build says the source compiles, not that the package carries it.
- **Every change needs a changeset.** No changeset, no release, and a
  consumer waiting on it waits forever.

# Bot code review

Codex reviews every PR; do not request Copilot. Read [the review manual](docs/BOT_CODE_REVIEW.md).
Batch verified fixes into one tested push per round; review each new head once via an automatic trigger or `@codex review`, without duplicate requests. Check both verdict surfaces against the current SHA. Read and answer every finding; verify claims, fix likely defects and decline unsupported claims with evidence. Preserve scrutiny for irreversible harm and take regressions in our fixes most seriously.
Routine PRs may merge after final-head review, required CI and approvals, and findings are addressed; high-risk PRs also require independent review. After three fix rounds, reassess scope rather than continuing patch churn. Never merge unread findings or force-push over them.

## Code Review Rules

- Runtime exports must reach published JavaScript, declarations and required
  assets. Safe path: check packed artifacts and consumer builds; source-only
  exports and a green workspace build are insufficient.
- Agent transport remains cross-runtime and module-agnostic. Safe path: put
  React/DOM bindings in UI packages and application behavior in extension points.
- Declared dependency ranges must install outside the workspace. Safe path:
  pack/release through the documented pnpm workflow and verify the packed
  manifest; do not ship unresolved workspace protocols.

# Opinionated form and renderer UX

Follow [docs/FORM_UX.md](docs/FORM_UX.md) for every native or generated form,
custom renderer and list-item inspector. Use the shared layout presets, existing
semantic theme tokens and spacing rhythm by default. Change that UX only on an
explicit user instruction. Open starts in view mode, Edit is explicit, and the
same labels, sections and value slots remain mounted in both modes. Verify actual
browser behavior at desktop and narrow widths and in light and dark themes.

Maintain form UX rules only in `docs/FORM_UX.md`; run `pnpm sync:form-ux` after changes. Plugin skills consume generated references and `pnpm check:form-ux` rejects drift.
