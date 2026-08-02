---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
---

Let the user choose how hard the model thinks, per conversation.

Adds a `ReasoningEffortPicker` to the composer (Auto / Fast / Balanced /
Thorough) backed by a persisted `reasoningEffortStore`. The choice rides on
every turn as an AG-UI `forwardedProps.reasoningEffort` and is read at send
time, so switching mid-conversation applies from the next message. `Auto`
sends nothing, leaving whatever the backend is configured for.

Effort is worth exposing because it is not a free knob: on the deployment
this was measured against, low effort often produced no reasoning summary at
all, while high effort cost noticeably more latency and tokens. That is a
judgement only the person asking the question can make.
