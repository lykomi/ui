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


# Bot code review (do not skip, do not merge around)

Every PR in this repo is reviewed by **Codex** (`chatgpt-codex-connector`) and
**GitHub Copilot**.

Their findings are not advisory noise. They have caught defects that green CI
and a passing local suite did not: a frozen column painted over a sticky
header, a parser that guessed a date's country, an admin write that read the
string `"false"` as consent, an endpoint broken by a careless in-place edit
that 3,059 passing tests never touched.

## Know which bot you are looking at

**Match on the numeric id, never the login** — the same bot answers to
different names on different endpoints.

| Bot | id | on `/pulls/{n}/reviews` | on the timeline |
|---|---|---|---|
| Copilot code review | `175728472` | `copilot-pull-request-reviewer[bot]` | `Copilot` |
| Codex | `199175422` | `chatgpt-codex-connector[bot]` | same |

`copilot-swe-agent` is a **third** bot — the coding agent, not the reviewer.
It is what GraphQL `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` returns,
and that enum has no reviewer capability at all, so its absence there says
nothing about whether a review can be requested.

## Asking for a review

**Copilot: request it over REST. It works — the response body lies.**

```bash
gh api -X POST repos/OWNER/REPO/pulls/N/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

The response echoes the PR with `requested_reviewers: []`, and so does a
`gh pr view` afterwards, because the field is cleared the moment the review
lands — and Copilot answers in three to six minutes. **Never read that empty
list as a failed request.** The timeline is the truth:

```bash
gh api --paginate repos/OWNER/REPO/issues/N/timeline \
  -q '.[] | select(.event == "review_requested")
       | select(.requested_reviewer.id == 175728472) | .created_at'
```

`gh pr edit N --add-reviewer @copilot` does the same thing. A `@copilot
review` comment also gets an answer, as a comment.

Copilot **reviews a PR once** unless the repo's ruleset enables *Review new
pushes*. On a branch that has moved since, re-request explicitly rather than
waiting for a pass that is not coming.

**Codex: comment `@codex review`.** Free text after the trigger is read as
instruction. It also runs on PR open and on ready-for-review where the repo
enables automatic reviews. Its rules can be steered from a `## Code Review
Rules` section in the nearest AGENTS.md.

## Finding out whether it actually reviewed

**A verdict does not always arrive as a review object.** This is the trap that
matters most:

| Bot | outcome | where it lands |
|---|---|---|
| Codex | findings | PR review — body starts `### 💡 Codex Review` |
| Codex | nothing found | **issue comment** — `Codex Review: Didn't find any major issues`, with `Reviewed commit:` |
| Copilot | either | PR review; a mention may also be answered as an issue comment |

So query **both** `/pulls/{n}/reviews` and `/issues/{n}/comments`, filter by
numeric id, and check the review's `commit_id` against the head SHA. Reading
only `pulls/.../reviews` once reported "not reviewed" on a PR Codex had signed
off cleanly two hours earlier.

And **`gh api` pages at 30**: without `--paginate`, a busy PR hides its most
recent reviews behind the first page and looks unreviewed.

## Is a review running right now?

Neither bot exposes a first-class state, and neither registers a check-run.
Two soft signals, both with caveats:

- **Codex** adds 👀 to the comment that triggered it, and removes it when it
  finishes. Present means running — but a stranded 👀 is also the known shape
  of a hang, so give it a deadline instead of waiting indefinitely.
- **Copilot** emits `copilot_work_started` seconds after the request.
  `copilot_work_finished` is unreliable and often never arrives, and a
  dangling `started` from hours ago means nothing. Bound it by age.

The dependable question is simply: *is there a review by that bot's id, newer
than my request, whose `commit_id` is my head?*

## The loop

1. **Push, then ask** — Codex by comment, Copilot by REST. Both, every round.
2. **Read every thread.** `gh api graphql` → `pullRequest.reviewThreads` with
   `isResolved` / `isOutdated`. A thread whose line still exists stays "live"
   after the fix, so judge by content, not by the flag.
3. **Fix, push, re-request, repeat.** Rounds do **not** converge
   monotonically. A real day on one PR: 6 findings, then 3, then 6, then 3,
   then 2 — and three of those rounds caught a bug introduced by the previous
   round's fix. A round that goes *up* is the process working.
4. **Take findings on your own fixes most seriously.** They are the ones
   nobody else will catch: a fix that regressed the case it was written for, a
   guard consulted but not applied, a test that cannot fail for its stated
   reason.
5. **Verify the claim before acting on it.** Read the code the bot cites.
   Roughly one finding in four is right about the rule and wrong about this
   code — answer that with the evidence, in the thread, and resolve it.
   "Fixed" and "declined, because…" are both finished; "unread" is not.
6. **Answer in the thread, then resolve it.** A reply is how the next reader
   knows a finding was considered rather than missed, and it is what makes
   round N+1 shorter.
7. **Stop when what is left is genuinely minor** — a style preference, churn
   that outweighs its value, a case the code deliberately does not support.
   Structural findings too large for the PR become issues, not silence.

A green suite is not evidence that a path works, only that the tested paths
do. When a bot finds something a full run missed, the lesson is usually that
the path had no test — and the fix is that one test, not a bigger suite.

Never merge with unread findings, and never close a thread by force-pushing
over it.
