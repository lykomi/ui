---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
---

Chat stream integrity + trustworthy working indicator.

A stream that closed without a terminal `RUN_FINISHED`/`RUN_ERROR` (proxy
idle-timeout, dropped connection, dead replica) previously looked like a
clean completion: the AG-UI client resolves `runAgent()` normally, so a
truncated answer rendered as final with no error and no indicator — the
silent-wedge bug.

- `AGUIRunner` now detects the protocol violation and emits an explicit
  `run-error` ("Connection to the agent was lost…"), and normalizes
  transport-level rejections onto the same `run-error` surface instead of
  throwing through the event stream.
- New `heartbeat` runner event: AG-UI `CUSTOM` events named `heartbeat`
  (emitted by the backend during long tool calls / thinking) refresh the
  client's liveness clock.
- New `stalled` streaming status with a configurable watchdog
  (`AGUIRunnerOptions.stallAfterMs`, default 45s): no event or heartbeat
  for that long flips the indicator to a distinct "still working — no
  signal" state, recovering automatically on the next event.
- `streamingStatusStore` gains `lastSignalAt` / `runStartedAt` +
  `touchSignal` / `markRunStarted` / `markRunEnded` so UIs can render
  elapsed time and staleness.
- `LoadingIndicator` shows the current phase with an amber stalled
  treatment; message action rows reveal a send/receive timestamp on hover.
  (The store's `runStartedAt`/`lastSignalAt` are available for hosts that
  want their own elapsed/staleness displays.)
