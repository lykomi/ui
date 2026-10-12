# Bot code review

Every PR in this repo is reviewed by **Codex** (`chatgpt-codex-connector`).
GitHub Copilot's reviewer is not used here — do not request it.

Its findings are not advisory noise. They have caught defects that green CI
and a passing local suite did not: a frozen column painted over a sticky
header, a parser that guessed a date's country, an admin write that read the
string `"false"` as consent, an endpoint broken by a careless in-place edit
that 3,059 passing tests never touched.

## Know the bot you are looking at

**Match on the numeric id, never the login.** Codex is `199175422`
(`chatgpt-codex-connector[bot]` on `/pulls/{n}/reviews` and on the timeline).

## Asking for a review

**Ensure review of each new head** — use an automatic trigger or comment
`@codex review`, after checking for an existing request/verdict. Free text
after the trigger is read as instruction. It also runs on PR open and on ready-for-review where the repo
enables automatic reviews. Its rules can be steered from a `## Code Review
Rules` section in the nearest AGENTS.md.

## Finding out whether it actually reviewed

**A verdict does not always arrive as a review object.** This is the trap that
matters most:

| Bot   | outcome       | where it lands                                                                            |
| ----- | ------------- | ----------------------------------------------------------------------------------------- |
| Codex | findings      | PR review — body starts `### 💡 Codex Review`                                             |
| Codex | nothing found | **issue comment** — `Codex Review: Didn't find any major issues`, with `Reviewed commit:` |

So query **both** `/pulls/{n}/reviews` and `/issues/{n}/comments`, filter by
numeric id, and check the review's `commit_id` against the head SHA. Reading
only `pulls/.../reviews` once reported "not reviewed" on a PR Codex had signed
off cleanly two hours earlier.

And **`gh api` pages at 30**: without `--paginate`, a busy PR hides its most
recent reviews behind the first page and looks unreviewed.

## Is a review running right now?

Codex exposes no first-class state and registers no check-run. The soft
signal: it adds 👀 to the comment that triggered it, and removes it when it
finishes. Treat it as a running hint, not proof: a stranded 👀 can indicate a hang.
Use a diagnostic checkpoint instead of waiting indefinitely. Its summary
comment ("Codex Review Summary") also shows _Running_ / _Completed_ per commit.

The dependable question has to cover **both** surfaces, because a clean Codex
pass has no `commit_id` to match — the SHA lives only in the comment body:

- a **submitted code review** by Codex's id, with a `Codex Review` Markdown
  heading (for example `### 💡 Codex Review`) and `commit_id` matching your head;
  exclude pending, dismissed and security-only reviews, **or**
- a **clean code-review issue comment** by Codex's id, beginning with
  `Codex Review: Didn't find any major issues`, whose `Reviewed commit:`
  marker names the head (the bot can abbreviate the SHA).

A summary, reaction, or security review alone does not satisfy code review.
Apply these signature checks in the manual/standalone procedure too, not just
in the helper. A matching review with findings proves review completion,
not that those findings are addressed.

Either one means it looked at this code. Waiting only for the first is how an
agent sits on a finished review indefinitely, or asks for it again.

## The loop: one complete batch per round

1. **Publish a reviewable starting head.** Keep one concern per PR. State the
   intended behavior, affected callers, risks and validation. Run required
   local checks, push the prepared commit, and open the PR as a draft. The
   reviewer must be able to inspect the remote commit, not unpublished edits.
2. **Request review of the pushed head once.** Check both verdict surfaces and
   existing requests before triggering `@codex review`. Use an automatic
   trigger when it covers this head; do not add a duplicate manual request.
   Run the independent high-risk pass alongside Codex where practical.
3. **Triage the entire round before editing.** Read review bodies, issue
   comments and every thread, including outdated ones. Check claims against
   code and actual callers. Fix likely defects; decline unsupported claims
   with evidence. Preserve scrutiny for irreversible data loss, ownership
   violations and widened credential scope, even on uncommon triggers.
4. **Prepare and validate one fix batch in draft.** If the PR is ready, return
   it to draft before pushing fixes. Prefer the smallest correct fix. For a
   behavioral defect, add a regression that fails before the fix and checks
   the reported path; also check affected callers and the original behavior.
   Run required checks after the batch; repeat only for changes, failures or
   unresolved concerns. Cross-npm changes still require standalone or CI
   validation against the published artifact.
5. **Push the tested batch once.** Verify the fixing commit is reachable on
   the PR branch before marking findings addressed. If the push fails,
   retain the local commit and leave affected threads open. If all findings
   are declined and the code is unchanged, no fix push is needed.
6. **Reply with evidence, then resolve.** For a fix, cite the pushed commit
   and test. For a decline, state the actual behavior and evidence. Leave a
   disagreement requiring adjudication open and explain why. Never resolve
   unread findings or findings whose fixing commit has not been pushed.
7. **Review a changed head; repeat as needed.** After the push and thread
   replies, return to step 2 for the new head. Include the previous reviewed
   SHA, changes, tests and declined findings. Prioritize fixes and affected
   paths without excluding the full PR from regression review. An unchanged
   head with addressed findings does not need another clean pass.
8. **Mark ready only after final-head review and fixes are complete.** The
   reviewed head must be pushed and all findings fixed or declined with
   evidence before the ready transition. Then wait for required CI and
   approvals on that head and recheck findings before merging. A ready event
   may itself trigger automatic review; do not add a duplicate manual request.
   Routine PRs may merge when these conditions hold; high-risk PRs additionally
   require the independent pass. Blocking defects cannot be deferred merely
   because they need a large fix. If a new fix is needed, return to step 4.

Draft status does not suppress this repository's full CI jobs. Inspect
`.github/workflows/ci.yml` before assuming any draft savings.

If a round creates more findings, determine whether they are regressions in
our fixes, previously missed defects, or unsupported claims. After three
fix/review rounds, pause patch churn and reassess scope and root cause; split
an unrelated change or seek adjudication where necessary. This is an
escalation point, never permission to merge unresolved defects.

For infrastructure failures, rerun only failed jobs (`gh run rerun <run-id>
--failed`). Do not create empty commits or rerun all suites to retry one job.

### Follow-up request template

Replace the placeholders with concrete evidence. Instructions guide the
review; they do not guarantee a shorter runtime or incremental-only review.

```text
@codex review
Previous reviewed head: <SHA>; current head: <SHA>.
This round: <fixes and affected callers>.
Validation: <regression cases and results>.
Declined findings: <thread links and supporting evidence>.
Prioritize regressions in these fixes and affected paths, while checking the
full PR for consequential defects. Identify the concrete failing scenario
and impact for each finding. Revisit a resolved finding when current code
contradicts the earlier evidence. Leave formatting to CI; avoid unrelated
refactors and unsupported hypothetical failures. Retain scrutiny for
irreversible data loss and permission or ownership violations.
```

## A second, independent pass for high-risk PRs

Codex is one reviewer. When a missed defect would be expensive, add a second,
independent review before merging:

- **What counts as high-risk:** permissions and auth, anything that deletes,
  prunes or overwrites data, migrations, the install/apply/publish/sync core,
  and anything a customer deploy depends on.
- **How:** use your tool's own review pass, and treat its findings like a Codex
  round: verify, then fix or answer. Claude Code's commands are in
  `CLAUDE.md`.
- Run the independent pass alongside Codex on the same head where practical.
  Record its reviewed SHA and outcome. If fixes change a risky path, recheck
  that path and its affected callers on the final head; reassess the full diff
  when scope expands. The author rereading their own patch is not independent.
- Routine PRs don't need it. Codex plus CI is the default.

Never merge with unread findings, and never close a thread by force-pushing
over it.

## Review guidance and evidence

Use `## Code Review Rules` in the applicable `AGENTS.md`. Keep root rules
cross-cutting and subsystem invariants near the code; start with two or three
consequential rules, each stating the invariant and safe path. Do not turn
style preferences into review blockers or suppress real defects with a
severity-only filter. Test guidance with an unsafe example, a safe example
and an unrelated change; narrow rules that repeatedly generate noise.

Grounding, checked 2026-10-12:

- [OpenAI: GitHub code review](https://learn.chatgpt.com/docs/third-party/github)
  documents automatic triggers, contextual review requests and scoped rules.
- [OpenAI: custom review rules](https://developers.openai.com/blog/custom-code-review-rules-for-codex)
  recommends concise invariants, explicit safe paths and mechanical checks in CI.
- The batching, stopping criteria and three-round reassessment above are our
  engineering policy, informed by the failures recorded here. They are not
  vendor guarantees about latency or convergence.

### Read-only status helper

From a cross-repository development workspace that provides the helper
(authenticated `gh` and Python 3 required):

```bash
python3 scripts/review-status.py iLoveAgents/foundry-ui 123 --json
python3 -m unittest discover -s scripts -p test_review_status.py -v
```

The helper checks code-review signatures on both verdict surfaces by bot
numeric id and current SHA (a security review alone does not count),
accepts the bot's abbreviated commit marker, paginates REST and GraphQL,
lists unresolved threads from all reviewers (including outdated ones), and
rechecks the head after inspection. It reads GitHub only: no comments,
resolutions, review requests, pushes or merges. Standalone users should use
this repository's API procedure above, including the signature checks; the
helper is optional and is not shipped here. A repository with no Codex
integration will report missing.

Exit 0 means **review evidence found**, not clean or mergeable. Exit 1 means
no matching evidence; queued, running, hung and never requested remain
indistinguishable. Exit 2 means unknown/error, including a head change.
An unrecognized verdict format fails conservatively as missing. Read review
bodies and all thread replies separately; this helper does not establish that
findings were read or correctly resolved, CI passed or approvals are valid.
Recheck the current head and merge gates immediately before merging.

Check status at bounded intervals (for example once per minute) while doing
independent work. After 15 minutes, inspect the existing task/request and
service state. This is a diagnostic checkpoint, not a runtime SLA; do not
keep triggering duplicates or infer completion from elapsed time or 👀.

### Measure whether the loop improves

For the next ten PRs, record risk class, changed files/lines, head SHA for
each round, request/start/completion times where exposed, CI duration,
verified/declined findings and defects introduced by fixes. Keep inferred
queue time separate from observed timestamps. Compare median and p90 time
to merge-ready, rounds per PR, duplicate requests and accepted findings per
round against ten comparable earlier PRs. Track escaped regressions too:
fewer comments alone do not prove better review. Revisit noisy rules using
these results; never loosen the irreversible-harm checks just to meet a target.
