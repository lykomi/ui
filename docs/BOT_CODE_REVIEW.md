# Bot code review

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

| Bot                 | id          | on `/pulls/{n}/reviews`              | on the timeline |
| ------------------- | ----------- | ------------------------------------ | --------------- |
| Copilot code review | `175728472` | `copilot-pull-request-reviewer[bot]` | `Copilot`       |
| Codex               | `199175422` | `chatgpt-codex-connector[bot]`       | same            |

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

Copilot **reviews a PR once** unless the repo's ruleset enables _Review new
pushes_. On a branch that has moved since, re-request explicitly rather than
waiting for a pass that is not coming.

**Codex: comment `@codex review`.** Free text after the trigger is read as
instruction. It also runs on PR open and on ready-for-review where the repo
enables automatic reviews. Its rules can be steered from a `## Code Review
Rules` section in the nearest AGENTS.md.

## Finding out whether it actually reviewed

**A verdict does not always arrive as a review object.** This is the trap that
matters most:

| Bot     | outcome       | where it lands                                                                            |
| ------- | ------------- | ----------------------------------------------------------------------------------------- |
| Codex   | findings      | PR review — body starts `### 💡 Codex Review`                                             |
| Codex   | nothing found | **issue comment** — `Codex Review: Didn't find any major issues`, with `Reviewed commit:` |
| Copilot | either        | PR review; a mention may also be answered as an issue comment                             |

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

The dependable question has to cover **both** surfaces, because a clean Codex
pass has no `commit_id` to match — the SHA lives only in the comment body:

- a **review** by that bot's id whose `commit_id` is your head, **or**
- an **issue comment** by that bot's id whose `Reviewed commit:` names it.

Either one means it looked at this code. Waiting only for the first is how an
agent sits on a finished review indefinitely, or asks for it again.

## The loop

1. **Push, then ask** — Codex by comment, Copilot by REST. Both, every round.
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
