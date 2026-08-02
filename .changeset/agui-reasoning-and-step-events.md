---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
---

Handle AG-UI reasoning and step events, which the runner previously dropped.

The runner subscribed to 11 of the 33 protocol event types. Two of the gaps
were costing real UX:

- **Reasoning** (`REASONING_*`, plus the deprecated `THINKING_*` aliases that
  `@ag-ui/client` normalizes onto them) now surfaces as a `reasoning-delta` /
  `reasoning-end` `RunnerEvent`, and the adapter emits it as an assistant-ui
  `reasoning` part rendered in a collapsed panel above the answer. Reasoning
  models emit these today and the text was being thrown away. Reasoning
  accumulates across the whole run rather than per turn, so a tool-call
  follow-up doesn't erase what the model thought before it.
- **Steps** (`STEP_STARTED` / `STEP_FINISHED`) now emit `step-started` /
  `step-finished` events, and `StreamingStatus` carries `stepName`. A long
  agentic run otherwise shows one opaque "thinking" state for minutes.

`StreamingStatus.status` gains a `"reasoning"` member; it reverts to
`"thinking"` when reasoning ends so the indicator can't stick.
