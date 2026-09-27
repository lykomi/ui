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

**Comment `@codex review`** — after opening the PR and after every push. Free text after the trigger is read as
instruction. It also runs on PR open and on ready-for-review where the repo
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
finishes. Present means running — but a stranded 👀 is also the known shape
of a hang, so give it a deadline instead of waiting indefinitely. Its summary
comment ("Codex Review Summary") also shows _Running_ / _Completed_ per commit.

The dependable question has to cover **both** surfaces, because a clean Codex
pass has no `commit_id` to match — the SHA lives only in the comment body:

- a **review** by Codex's id whose `commit_id` is your head, **or**
- an **issue comment** by Codex's id whose `Reviewed commit:` names it.

Either one means it looked at this code. Waiting only for the first is how an
agent sits on a finished review indefinitely, or asks for it again.

## The loop

1. **Push, then ask** — `@codex review`, every round.
2. **Read every thread.** `gh api graphql` → `pullRequest.reviewThreads` with
   `isResolved` / `isOutdated`. A thread whose line still exists stays "live"
   after the fix, so judge by content, not by the flag.
3. **Fix, push, re-request, repeat.** Rounds do **not** converge
   monotonically. A real day on one PR: 6 findings, then 3, then 6, then 3,
   then 2 — and three of those rounds caught a bug introduced by the previous
   round's fix. A round that goes _up_ is the process working.
4. **Take findings on your own fixes most seriously.** They are the ones
   nobody else will catch: a fix that regressed the case it was written for, a
   guard consulted but not applied, a test that cannot fail for its stated
   reason.
5. **Verify the claim before acting on it.** Read the code the bot cites.
   Roughly one finding in four is right about the rule and wrong about this
   code — answer that with the evidence, in the thread, and resolve it.
   "Fixed" and "declined, because…" are both finished; "unread" is not.
6. **Fix the likely; decline the hypothetical — except where it destroys.** A
   finding that needs a contrived chain of failures to reach gets an answer in
   the thread, not a patch. This is not laziness: every speculative fix is new
   code, and new code is what the next round finds defects in. One PR here ran
   5 → 10 → 10 → 11 findings without converging, and most of that growth was
   the previous round's speculative hardening being critiqued in turn.

   Weigh the exception by what a mistake COSTS, not by which verb the code
   uses. Deleting a temp file, dropping a cache, or rewriting state that
   regenerates itself is ordinary. An outcome nobody can undo — a resource
   someone still depends on deleted or purged, state that cannot be
   reproduced overwritten, a credential's scope widened — is worth fixing even
   on an uncommon trigger, because there is no second chance to get it right.

   On that same PR the two findings that genuinely mattered were both of that
   kind: a teardown whose prefix match would have deleted a **still-live
   sibling environment's** identities (an environment named `foo` builds a
   prefix that also matches everything belonging to `foo-two`), and a purge
   that could have destroyed a secrets vault the deployment did not own.

7. **Answer in the thread, then resolve it.** A reply is how the next reader
   knows a finding was considered rather than missed, and it is what makes
   round N+1 shorter.
8. **Stop when what is left is genuinely minor** — a style preference, churn
   that outweighs its value, a case the code deliberately does not support.
   Structural findings too large for the PR become issues, not silence.

A green suite is not evidence that a path works, only that the tested paths
do. When a bot finds something a full run missed, the lesson is usually that
the path had no test — and the fix is that one test, not a bigger suite.

## A second, independent pass for high-risk PRs

Codex is one reviewer. For changes where a missed defect is expensive, add a
second pass from a different reviewer before merging:

- **What counts as high-risk:** permissions and auth, anything that deletes,
  prunes or overwrites data, migrations, the install/apply/publish/sync core,
  and anything a customer deploy depends on.
- **`/code-review` at high effort** (Claude Code, local). An agent may run
  this itself. Treat its findings like a Codex round: verify, fix or answer.
- **`/code-review ultra`** is a multi-agent review that runs in the cloud. It is
  started by the user and billed, and an agent cannot launch it. For the
  riskiest changes, an agent _suggests_ it to the user and says why.
- Routine PRs don't get either. Codex plus CI is the default.

Never merge with unread findings, and never close a thread by force-pushing
over it.
