---
"create-foundry-ui-app": patch
---

fix(template): scaffold the assistant-ui version the packages actually require

The generated app asked for `@assistant-ui/react ^0.12.25` while
`@iloveagents/foundry-web-ui` declares `^0.15.1` as a peer. pnpm warns about an
unmet peer and installs anyway, so every scaffolded app carried an
assistant-ui two minor lines behind the packages it was scaffolding — a latent
break that stayed invisible until web-ui used a 0.15-only export and the
starter build died on `"groupPartByType" is not exported`.

The template now tracks the peer range, and no longer pins
`@assistant-ui/store` / `tap` at all: those pins had to move in lock-step with
`@assistant-ui/react` and nothing made that happen, which is precisely how the
drift accumulated. assistant-ui's own dependency ranges resolve a consistent
graph without help. A unit test now fails when the template's range and the
peer disagree, so the next drift is caught at the range, not at a build.
